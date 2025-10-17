import { ClickHouseClient, createClient } from "@clickhouse/client";
import {
  ClickHouseConfig,
  DashboardStats,
  EventData,
  UserContext,
} from "./types.ts";

// Import broadcast functions for real-time updates
let broadcastEvent: ((event: any) => void) | null = null;
let broadcastStats: ((stats: any) => void) | null = null;

// Dynamic import to avoid circular dependency
try {
  const wsModule = await import("../routes/api/ws.ts");
  broadcastEvent = wsModule.broadcastEvent;
  broadcastStats = wsModule.broadcastStats;
} catch (error) {
  console.log("WebSocket module not available for broadcasting");
}

export class ClickHouseService {
  config: ClickHouseConfig;
  private client: ClickHouseClient;
  private eventBuffer: EventData[] = [];
  private userEventBuffers: Map<string, EventData[]> = new Map();
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private statsInterval = 10000; // 10 seconds
  private userTableCache: Map<string, string> = new Map();
  private flushIntervalId?: number;
  private statsIntervalId?: number;

  constructor(config: ClickHouseConfig) {
    this.config = config;

    // Create ClickHouse client with official SDK
    this.client = createClient({
      url: `http://${config.host}:${config.port}`,
      username: config.username,
      password: config.password,
      database: config.systemDatabase || config.database || "default",
      request_timeout: 30000,
      compression: {
        response: true,
        request: true,
      },
    });

    this.startBufferFlush();
    this.startStatsUpdates();
  }

  /**
   * Sanitizes user ID to be safe for use in ClickHouse table names
   * Replaces special characters with underscores and ensures valid identifier format
   */
  private sanitizeUserId(userId: string): string {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    // Trim whitespace
    let sanitized = userId.trim();

    if (sanitized.length === 0) {
      throw new Error("User ID cannot be empty or only whitespace");
    }

    // Replace special characters with underscores
    // Keep only alphanumeric characters and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");

    // Clean up multiple consecutive underscores
    sanitized = sanitized.replace(/_+/g, "_");

    // Remove trailing underscores
    sanitized = sanitized.replace(/_+$/, "");

    // Remove leading underscores
    sanitized = sanitized.replace(/^_+/, "");

    // If we're left with nothing but had content before, create a fallback
    if (sanitized.length === 0) {
      sanitized = "user";
    }

    // Ensure it doesn't start with a number (ClickHouse identifier requirement)
    if (/^[0-9]/.test(sanitized)) {
      sanitized = "u_" + sanitized;
    }

    // Limit length to avoid ClickHouse identifier limits (max 127 characters)
    // Reserve space for table prefix, so limit user part to 100 characters
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
      // Remove trailing underscore if truncation created one
      sanitized = sanitized.replace(/_+$/, "");
    }

    // Final validation - must not be empty after sanitization
    if (sanitized.length === 0) {
      sanitized = "user";
    }

    return sanitized;
  }

  /**
   * Generates a consistent table name for a user
   * Uses the configured table prefix and sanitized user ID
   */
  getUserTableName(userId: string): string {
    // Check cache first for performance
    if (this.userTableCache.has(userId)) {
      return this.userTableCache.get(userId)!;
    }

    const sanitizedUserId = this.sanitizeUserId(userId);
    const tablePrefix = this.config.tablePrefix;

    // Handle empty table prefix case - check for empty string specifically
    const tableName = tablePrefix !== undefined && tablePrefix !== ""
      ? `${tablePrefix}_${sanitizedUserId}`
      : sanitizedUserId;

    // Validate final table name length
    if (tableName.length > 127) {
      throw new Error(
        `Generated table name exceeds ClickHouse identifier limit: ${tableName}`,
      );
    }

    // Validate table name format (ClickHouse identifier rules)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(
        `Generated table name is not a valid ClickHouse identifier: ${tableName}`,
      );
    }

    // Cache the result
    this.userTableCache.set(userId, tableName);

    return tableName;
  }

  /**
   * Validates if a string is a valid ClickHouse identifier
   */
  private isValidClickHouseIdentifier(identifier: string): boolean {
    if (!identifier || identifier.length === 0 || identifier.length > 127) {
      return false;
    }

    // Must start with letter or underscore, followed by letters, numbers, or underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  }

  /**
   * Execute a query against a specific database
   */
  async queryDatabase(database: string, query: string): Promise<string> {
    try {
      const result = await this.client.query({
        query,
        format: "TabSeparated",
        clickhouse_settings: {
          database,
        },
      });
      return await result.text();
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Query failed on database '${database}': ${errorMessage}`,
      );
    }
  }

  /**
   * Execute a query against a specific database and return JSON results
   */
  async queryDatabaseJSON(
    database: string,
    query: string,
    queryParams?: Record<string, any>,
  ): Promise<any[]> {
    try {
      const result = await this.client.query({
        query,
        format: "JSONEachRow",
        query_params: queryParams,
        clickhouse_settings: {
          database,
        },
      });
      return await result.json();
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Query failed on database '${database}': ${errorMessage}`,
      );
    }
  }

  /**
   * Legacy query method - uses system database by default
   */
  async query(query: string): Promise<string> {
    const database = this.config.systemDatabase || this.config.database ||
      "default";
    return this.queryDatabase(database, query);
  }

  /**
   * Legacy queryJSON method - uses system database by default
   */
  async queryJSON(query: string): Promise<any[]> {
    const database = this.config.systemDatabase || this.config.database ||
      "default";
    return this.queryDatabaseJSON(database, query);
  }

  /**
   * Initialize the user database for storing user-specific tables
   * Creates the database if it doesn't exist
   */
  async initializeUserDatabase(): Promise<void> {
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      // Create the user database if it doesn't exist
      const createDbQuery = `CREATE DATABASE IF NOT EXISTS ${userDatabase}`;
      await this.client.command({
        query: createDbQuery,
      });

      console.log(`User database '${userDatabase}' initialized successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(
        `Failed to initialize user database '${userDatabase}': ${errorMessage}`,
      );
    }
  }

  /**
   * Creates a user-specific table with the standard events schema
   * Returns the table name that was created
   */
  async createUserTable(userId: string): Promise<string> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      // Ensure user database exists first
      await this.initializeUserDatabase();

      const createQuery = `
        CREATE TABLE IF NOT EXISTS ${userDatabase}.${tableName} (
          id String DEFAULT generateUUIDv4(),
          timestamp DateTime DEFAULT now(),
          data JSON,
          source String DEFAULT '',
          ip String DEFAULT '',
          user_agent String DEFAULT '',
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (timestamp, id)
        SETTINGS index_granularity = 8192
      `;

      await this.client.command({
        query: createQuery,
        clickhouse_settings: {
          database: userDatabase,
        },
      });

      console.log(
        `User table '${tableName}' created successfully in database '${userDatabase}'`,
      );

      return tableName;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to create user table for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Ensures a user table exists, creating it if necessary
   * Returns the table name
   */
  async ensureUserTable(userId: string): Promise<string> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      // Check if table already exists
      const checkQuery =
        `SELECT 1 FROM system.tables WHERE database = '${userDatabase}' AND name = '${tableName}' LIMIT 1`;
      const result = await this.client.query({
        query: checkQuery,
        format: "JSONEachRow",
        clickhouse_settings: {
          database: "system",
        },
      });
      const rows = await result.json();

      if (rows.length > 0) {
        // Table exists, return the name
        return tableName;
      }

      // Table doesn't exist, create it
      return await this.createUserTable(userId);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to ensure user table for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Initialize system database and legacy table (for backward compatibility)
   */
  async initialize() {
    // Use legacy tableName if available, otherwise use a default
    const tableName = (this.config as any).tableName || "events";
    const systemDatabase = this.config.systemDatabase || this.config.database ||
      "default";

    const createQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id String DEFAULT generateUUIDv4(),
        timestamp DateTime DEFAULT now(),
        data JSON,
        source String DEFAULT '',
        ip String DEFAULT '',
        user_agent String DEFAULT '',
        created_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (timestamp, id)
      SETTINGS index_granularity = 8192
    `;

    await this.client.command({
      query: createQuery,
      clickhouse_settings: {
        database: systemDatabase,
      },
    });
    console.log(`System database '${systemDatabase}' initialized successfully`);
  }

  async insertEvent(event: EventData, userId?: string): Promise<void> {
    if (userId) {
      return this.insertEventForUser(userId, event);
    }

    const formattedEvent = {
      id: event.id || crypto.randomUUID(),
      timestamp: event.timestamp || new Date().toISOString(),
      data: JSON.stringify(event.data),
      source: event.source || "",
      ip: event.ip || "",
      user_agent: event.user_agent || "",
    };

    // Store the formatted event with stringified data for ClickHouse
    this.eventBuffer.push(formattedEvent as any);

    // Broadcast new event to connected clients
    if (broadcastEvent) {
      broadcastEvent({
        id: formattedEvent.id,
        timestamp: formattedEvent.timestamp,
        data: event.data, // Send original data, not stringified
        source: formattedEvent.source,
        ip: formattedEvent.ip,
      });
    }

    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Insert event into user-specific table with buffering
   */
  async insertEventForUser(userId: string, event: EventData): Promise<void> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    // Ensure user table exists
    await this.ensureUserTable(userId);

    const formattedEvent = {
      id: event.id || crypto.randomUUID(),
      timestamp: event.timestamp || new Date().toISOString(),
      data: JSON.stringify(event.data),
      source: event.source || "",
      ip: event.ip || "",
      user_agent: event.user_agent || "",
    };

    // Get or create user-specific buffer
    if (!this.userEventBuffers.has(userId)) {
      this.userEventBuffers.set(userId, []);
    }

    const userBuffer = this.userEventBuffers.get(userId)!;
    userBuffer.push(formattedEvent as any);

    // Broadcast new event to connected clients
    if (broadcastEvent) {
      broadcastEvent({
        id: formattedEvent.id,
        timestamp: formattedEvent.timestamp,
        data: event.data, // Send original data, not stringified
        source: formattedEvent.source,
        ip: formattedEvent.ip,
        userId: userId, // Include user context in broadcast
      });
    }

    // Flush user buffer if it reaches the buffer size
    if (userBuffer.length >= this.bufferSize) {
      await this.flushUserBuffer(userId);
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = this.eventBuffer.splice(0);
    const tableName = (this.config as any).tableName || "events";

    try {
      await this.client.insert({
        table: tableName,
        values: events,
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Buffer flush error:", error);
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Flush events from a specific user's buffer to their table
   */
  private async flushUserBuffer(userId: string): Promise<void> {
    const userBuffer = this.userEventBuffers.get(userId);
    if (!userBuffer || userBuffer.length === 0) return;

    const events = userBuffer.splice(0);
    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      await this.client.insert({
        table: `${userDatabase}.${tableName}`,
        values: events,
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error(`User buffer flush error for user '${userId}':`, error);
      userBuffer.unshift(...events);
    }
  }

  private startBufferFlush(): void {
    this.flushIntervalId = setInterval(() => {
      // Flush legacy buffer
      this.flushBuffer().catch(console.error);

      // Flush all user buffers
      this.flushAllUserBuffers().catch(console.error);
    }, this.flushInterval);
  }

  /**
   * Flush all user buffers that have pending events
   */
  private async flushAllUserBuffers(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    for (const userId of this.userEventBuffers.keys()) {
      const userBuffer = this.userEventBuffers.get(userId);
      if (userBuffer && userBuffer.length > 0) {
        flushPromises.push(this.flushUserBuffer(userId));
      }
    }

    if (flushPromises.length > 0) {
      await Promise.allSettled(flushPromises);
    }
  }

  private startStatsUpdates(): void {
    this.statsIntervalId = setInterval(async () => {
      try {
        if (broadcastStats) {
          const stats = await this.getStats();
          broadcastStats(stats);
        }
      } catch (error) {
        console.error("Stats broadcast error:", error);
      }
    }, this.statsInterval);
  }

  /**
   * Cleanup method to clear intervals and prevent memory leaks
   * Should be called when the service is no longer needed
   */
  async cleanup(): Promise<void> {
    if (this.flushIntervalId !== undefined) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = undefined;
    }
    if (this.statsIntervalId !== undefined) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = undefined;
    }

    // Close the ClickHouse client connection
    await this.client.close();
  }

  async getStats(userId?: string): Promise<DashboardStats> {
    if (userId) {
      return this.getStatsForUser(userId);
    }

    // Legacy behavior - query system/shared table
    const tableName = (this.config as any).tableName || "events";
    const queries = [
      `SELECT count() as total FROM ${tableName}`,
      `SELECT count() as today FROM ${tableName} WHERE toDate(timestamp) = today()`,
      `SELECT count() as hour FROM ${tableName} WHERE timestamp >= now() - INTERVAL 1 HOUR`,
      `SELECT formatReadableSize(sum(length(data))) as size FROM ${tableName}`,
      `SELECT id, timestamp, data, source, ip FROM ${tableName} ORDER BY timestamp DESC LIMIT 10`,
    ];

    const [total, today, hour, size, recent] = await Promise.all([
      this.queryJSON(queries[0]),
      this.queryJSON(queries[1]),
      this.queryJSON(queries[2]),
      this.queryJSON(queries[3]),
      this.queryJSON(queries[4]),
    ]);

    return {
      totalEvents: total[0]?.total || 0,
      eventsToday: today[0]?.today || 0,
      eventsLastHour: hour[0]?.hour || 0,
      dataSize: size[0]?.size || "0 B",
      recentEvents: recent.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
        source: r.source,
        ip: r.ip,
      })),
    };
  }

  /**
   * Get statistics for a specific user from their dedicated table
   */
  async getStatsForUser(userId: string): Promise<DashboardStats> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    // Ensure user table exists
    await this.ensureUserTable(userId);

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    const queries = [
      `SELECT count() as total FROM ${userDatabase}.${tableName}`,
      `SELECT count() as today FROM ${userDatabase}.${tableName} WHERE toDate(timestamp) = today()`,
      `SELECT count() as hour FROM ${userDatabase}.${tableName} WHERE timestamp >= now() - INTERVAL 1 HOUR`,
      `SELECT formatReadableSize(sum(length(data))) as size FROM ${userDatabase}.${tableName}`,
      `SELECT id, timestamp, data, source, ip FROM ${userDatabase}.${tableName} ORDER BY timestamp DESC LIMIT 10`,
    ];

    try {
      const [total, today, hour, size, recent] = await Promise.all([
        this.queryDatabaseJSON(userDatabase, queries[0]),
        this.queryDatabaseJSON(userDatabase, queries[1]),
        this.queryDatabaseJSON(userDatabase, queries[2]),
        this.queryDatabaseJSON(userDatabase, queries[3]),
        this.queryDatabaseJSON(userDatabase, queries[4]),
      ]);

      return {
        totalEvents: total[0]?.total || 0,
        eventsToday: today[0]?.today || 0,
        eventsLastHour: hour[0]?.hour || 0,
        dataSize: size[0]?.size || "0 B",
        recentEvents: recent.map((r) => ({
          id: r.id,
          timestamp: r.timestamp,
          data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
          source: r.source,
          ip: r.ip,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to get stats for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Query a user-specific table with custom SQL
   */
  async queryUserTable(userId: string, query: string): Promise<any[]> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    if (!query || typeof query !== "string") {
      throw new Error("Query must be a non-empty string");
    }

    // Ensure user table exists
    await this.ensureUserTable(userId);

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      // Replace table placeholder in query if present
      const processedQuery = query.replace(
        /\{userTable\}/g,
        `${userDatabase}.${tableName}`,
      );

      return await this.queryDatabaseJSON(userDatabase, processedQuery);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to query user table for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * List all user tables in the user database for administrative operations
   * Returns an array of table names that match the user table pattern
   */
  async listUserTables(): Promise<string[]> {
    const userDatabase = this.config.userDatabase || "user_events";
    const tablePrefix = this.config.tablePrefix || "events_user";

    try {
      // Query system.tables to find all tables in the user database that match our pattern
      const query = `
        SELECT name 
        FROM system.tables 
        WHERE database = '${userDatabase}' 
        AND name LIKE '${tablePrefix}_%'
        ORDER BY name
      `;

      const result = await this.client.query({
        query,
        format: "JSONEachRow",
        clickhouse_settings: {
          database: "system",
        },
      });
      const rows = await result.json();
      return rows.map((row: any) => row.name);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to list user tables: ${errorMessage}`);
    }
  }

  /**
   * Drop a user's table for cleanup operations
   * This permanently deletes all data for the specified user
   */
  async dropUserTable(userId: string): Promise<void> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    try {
      // Check if table exists before attempting to drop
      const checkQuery =
        `SELECT 1 FROM system.tables WHERE database = '${userDatabase}' AND name = '${tableName}' LIMIT 1`;
      const result = await this.client.query({
        query: checkQuery,
        format: "JSONEachRow",
        clickhouse_settings: {
          database: "system",
        },
      });
      const exists = await result.json();

      if (exists.length === 0) {
        throw new Error(
          `User table '${tableName}' does not exist in database '${userDatabase}'`,
        );
      }

      // Drop the table
      const dropQuery = `DROP TABLE ${userDatabase}.${tableName}`;
      await this.client.command({
        query: dropQuery,
        clickhouse_settings: {
          database: userDatabase,
        },
      });

      // Clear the table name from cache
      this.userTableCache.delete(userId);

      // Clear user buffer if it exists
      this.userEventBuffers.delete(userId);

      console.log(
        `User table '${tableName}' dropped successfully from database '${userDatabase}'`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to drop user table for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Validate the integrity of a user's table for data verification
   * Checks table structure, data consistency, and returns validation results
   */
  async validateUserTableIntegrity(userId: string): Promise<{
    isValid: boolean;
    tableExists: boolean;
    schemaValid: boolean;
    recordCount: number;
    issues: string[];
  }> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    const tableName = this.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";
    const issues: string[] = [];
    let isValid = true;
    let tableExists = false;
    let schemaValid = false;
    let recordCount = 0;

    try {
      // Check if table exists
      const existsQuery =
        `SELECT 1 FROM system.tables WHERE database = '${userDatabase}' AND name = '${tableName}' LIMIT 1`;
      const existsResult = await this.client.query({
        query: existsQuery,
        format: "JSONEachRow",
        clickhouse_settings: {
          database: "system",
        },
      });
      const existsRows = await existsResult.json();
      tableExists = existsRows.length > 0;

      if (!tableExists) {
        issues.push(
          `Table '${tableName}' does not exist in database '${userDatabase}'`,
        );
        isValid = false;
        return { isValid, tableExists, schemaValid, recordCount, issues };
      }

      // Validate table schema
      const schemaQuery = `
        SELECT name, type 
        FROM system.columns 
        WHERE database = '${userDatabase}' AND table = '${tableName}'
        ORDER BY name
      `;
      const schemaResult = await this.client.query({
        query: schemaQuery,
        format: "JSONEachRow",
        clickhouse_settings: {
          database: "system",
        },
      });
      const schemaRows = await schemaResult.json();

      // Expected columns and their types
      const expectedSchema = {
        id: "String",
        timestamp: "DateTime",
        data: "Object('json')",
        source: "String",
        ip: "String",
        user_agent: "String",
        created_at: "DateTime",
      };

      // Check if all expected columns exist with correct types
      const actualColumns = new Map(
        schemaRows.map((col: any) => [col.name, col.type]),
      );

      for (const [columnName, expectedType] of Object.entries(expectedSchema)) {
        if (!actualColumns.has(columnName)) {
          issues.push(`Missing column: ${columnName}`);
          isValid = false;
        } else {
          const actualType = actualColumns.get(columnName);
          // Allow some flexibility in type matching (e.g., Object('json') vs JSON)
          if (
            actualType !== expectedType &&
            !(
              columnName === "data" &&
              (actualType === "JSON" || actualType?.includes("json"))
            )
          ) {
            issues.push(
              `Column '${columnName}' has type '${actualType}', expected '${expectedType}'`,
            );
            isValid = false;
          }
        }
      }

      // Check for unexpected columns
      for (const columnName of actualColumns.keys()) {
        if (!expectedSchema.hasOwnProperty(columnName)) {
          issues.push(`Unexpected column: ${columnName}`);
          // This is not necessarily invalid, just noteworthy
        }
      }

      schemaValid = issues.length === 0;

      // Get record count
      const countQuery =
        `SELECT count() as count FROM ${userDatabase}.${tableName}`;
      const countResult = await this.queryDatabaseJSON(
        userDatabase,
        countQuery,
      );
      recordCount = countResult[0]?.count || 0;

      // Check for data consistency issues
      if (recordCount > 0) {
        // Check for null IDs
        const nullIdQuery =
          `SELECT count() as count FROM ${userDatabase}.${tableName} WHERE id = ''`;
        const nullIdResult = await this.queryDatabaseJSON(
          userDatabase,
          nullIdQuery,
        );
        const nullIdCount = nullIdResult[0]?.count || 0;

        if (nullIdCount > 0) {
          issues.push(`Found ${nullIdCount} records with empty ID`);
          isValid = false;
        }

        // Check for invalid timestamps
        const invalidTimestampQuery =
          `SELECT count() as count FROM ${userDatabase}.${tableName} WHERE timestamp = '1970-01-01 00:00:00'`;
        const invalidTimestampResult = await this.queryDatabaseJSON(
          userDatabase,
          invalidTimestampQuery,
        );
        const invalidTimestampCount = invalidTimestampResult[0]?.count || 0;

        if (invalidTimestampCount > 0) {
          issues.push(
            `Found ${invalidTimestampCount} records with invalid timestamps`,
          );
          isValid = false;
        }

        // Check for malformed JSON data
        try {
          const jsonCheckQuery =
            `SELECT count() as count FROM ${userDatabase}.${tableName} WHERE NOT isValidJSON(data)`;
          const jsonCheckResult = await this.queryDatabaseJSON(
            userDatabase,
            jsonCheckQuery,
          );
          const invalidJsonCount = jsonCheckResult[0]?.count || 0;

          if (invalidJsonCount > 0) {
            issues.push(
              `Found ${invalidJsonCount} records with invalid JSON data`,
            );
            isValid = false;
          }
        } catch (error) {
          // isValidJSON might not be available in all ClickHouse versions
          issues.push(
            "Could not validate JSON data format (isValidJSON function not available)",
          );
        }
      }

      return {
        isValid,
        tableExists,
        schemaValid,
        recordCount,
        issues,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      issues.push(`Validation error: ${errorMessage}`);
      return {
        isValid: false,
        tableExists,
        schemaValid,
        recordCount,
        issues,
      };
    }
  }

  /**
   * Get comprehensive statistics about user table usage
   * Returns information about all user tables and their sizes
   */
  async getUserTableStatistics(): Promise<{
    totalTables: number;
    totalEvents: number;
    totalSize: string;
    tables: Array<{
      tableName: string;
      userId: string;
      eventCount: number;
      dataSize: string;
      lastActivity: string | null;
    }>;
  }> {
    const userDatabase = this.config.userDatabase || "user_events";
    const tablePrefix = this.config.tablePrefix || "events_user";

    try {
      // Get all user tables
      const userTables = await this.listUserTables();

      const tableStats = [];
      let totalEvents = 0;
      let totalSizeBytes = 0;

      for (const tableName of userTables) {
        try {
          // Extract user ID from table name
          const userId = tableName.startsWith(tablePrefix + "_")
            ? tableName.substring(tablePrefix.length + 1)
            : tableName;

          // Get table statistics
          const statsQueries = [
            `SELECT count() as count FROM ${userDatabase}.${tableName}`,
            `SELECT sum(length(data)) as size FROM ${userDatabase}.${tableName}`,
            `SELECT max(timestamp) as last_activity FROM ${userDatabase}.${tableName}`,
          ];

          const [countResult, sizeResult, activityResult] = await Promise.all([
            this.queryDatabaseJSON(userDatabase, statsQueries[0]),
            this.queryDatabaseJSON(userDatabase, statsQueries[1]),
            this.queryDatabaseJSON(userDatabase, statsQueries[2]),
          ]);

          const eventCount = countResult[0]?.count || 0;
          const sizeBytes = sizeResult[0]?.size || 0;
          const lastActivity = activityResult[0]?.last_activity || null;

          totalEvents += eventCount;
          totalSizeBytes += sizeBytes;

          // Format size for display
          const formatSize = (bytes: number): string => {
            if (bytes === 0) return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return (
              parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
            );
          };

          tableStats.push({
            tableName,
            userId,
            eventCount,
            dataSize: formatSize(sizeBytes),
            lastActivity,
          });
        } catch (error) {
          console.error(`Error getting stats for table ${tableName}:`, error);
          // Continue with other tables even if one fails
          tableStats.push({
            tableName,
            userId: "unknown",
            eventCount: 0,
            dataSize: "0 B",
            lastActivity: null,
          });
        }
      }

      // Format total size
      const formatTotalSize = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      };

      return {
        totalTables: userTables.length,
        totalEvents,
        totalSize: formatTotalSize(totalSizeBytes),
        tables: tableStats.sort((a, b) => b.eventCount - a.eventCount), // Sort by event count descending
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to get user table statistics: ${errorMessage}`);
    }
  }

  /**
   * Ping the ClickHouse server to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.query({
        query: "SELECT 1",
        format: "JSONEachRow",
      });
      const rows = (await result.json()) as Array<{ "1": number }>;
      return rows.length > 0 && rows[0]["1"] === 1;
    } catch (error) {
      console.error("ClickHouse ping failed:", error);
      return false;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<{
    version: string;
    uptime: number;
    timezone: string;
  }> {
    try {
      const queries = [
        "SELECT version() as version",
        "SELECT uptime() as uptime",
        "SELECT timezone() as timezone",
      ];

      const [versionResult, uptimeResult, timezoneResult] = await Promise.all([
        this.client.query({ query: queries[0], format: "JSONEachRow" }),
        this.client.query({ query: queries[1], format: "JSONEachRow" }),
        this.client.query({ query: queries[2], format: "JSONEachRow" }),
      ]);

      const [versionRows, uptimeRows, timezoneRows] = await Promise.all([
        versionResult.json() as Promise<Array<{ version: string }>>,
        uptimeResult.json() as Promise<Array<{ uptime: number }>>,
        timezoneResult.json() as Promise<Array<{ timezone: string }>>,
      ]);

      return {
        version: versionRows[0]?.version || "unknown",
        uptime: uptimeRows[0]?.uptime || 0,
        timezone: timezoneRows[0]?.timezone || "unknown",
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to get server info: ${errorMessage}`);
    }
  }
}

// Export a singleton instance for backward compatibility
let clickHouseInstance: ClickHouseService | null = null;

export function getClickHouseService(
  config?: ClickHouseConfig,
): ClickHouseService {
  if (!clickHouseInstance && config) {
    clickHouseInstance = new ClickHouseService(config);
  } else if (!clickHouseInstance) {
    throw new Error(
      "ClickHouse service not initialized. Provide config on first call.",
    );
  }
  return clickHouseInstance;
}

export function resetClickHouseService(): void {
  if (clickHouseInstance) {
    clickHouseInstance.cleanup();
    clickHouseInstance = null;
  }
}
/**

 * UserContextManager handles user-specific operations and context management
 * Provides a higher-level interface for managing user tables and contexts
 */
export class UserContextManager {
  private clickhouse: ClickHouseService;
  private contextCache: Map<string, UserContext> = new Map();
  private inFlightRequests: Map<string, Promise<UserContext | null>> =
    new Map();

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
  }

  /**
   * Validates user ID using the same validation logic as sanitizeUserId
   * Throws consistent error messages for invalid user IDs
   */
  private validateAndSanitizeUserId(userId: string): void {
    // Consistent validation that matches sanitizeUserId requirements
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    const trimmed = userId.trim();
    if (trimmed.length === 0) {
      throw new Error("User ID cannot be empty or only whitespace");
    }

    // Validate maximum length to prevent excessively long user IDs
    // sanitizeUserId limits to 100 characters after processing, so reject anything > 200 before processing
    if (trimmed.length > 200) {
      throw new Error(
        `User ID exceeds maximum allowed length of 200 characters (got ${trimmed.length})`,
      );
    }
  }

  /**
   * Legacy validation method - kept for backward compatibility
   * @deprecated Use validateAndSanitizeUserId for consistent error handling
   */
  validateUserId(userId: string): boolean {
    try {
      this.validateAndSanitizeUserId(userId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensures a user context exists, creating the user table if necessary
   * Returns the user context with table information
   */
  async ensureUserContext(userId: string): Promise<UserContext> {
    // Consolidated validation with consistent error messages
    this.validateAndSanitizeUserId(userId);

    // Check cache first
    if (this.contextCache.has(userId)) {
      return this.contextCache.get(userId)!;
    }

    try {
      // Ensure user table exists
      const tableName = await this.clickhouse.ensureUserTable(userId);
      const userDatabase = this.clickhouse.config.userDatabase || "user_events";

      const context: UserContext = {
        userId,
        tableName,
        database: userDatabase,
      };

      // Cache the context
      this.contextCache.set(userId, context);

      return context;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to ensure user context for '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Gets the user context if it exists, without creating it
   * Returns null if the context doesn't exist
   * Uses async locking to prevent duplicate database queries for concurrent requests
   */
  async getUserContext(userId: string): Promise<UserContext | null> {
    // Validate user ID first
    try {
      this.validateAndSanitizeUserId(userId);
    } catch {
      return null;
    }

    // Check cache first
    if (this.contextCache.has(userId)) {
      return this.contextCache.get(userId)!;
    }

    // Check if there's already an in-flight request for this user
    // This prevents duplicate database queries for concurrent calls
    const existingRequest = this.inFlightRequests.get(userId);
    if (existingRequest) {
      return existingRequest;
    }

    // Create and track the database query promise
    const requestPromise = this.fetchUserContextFromDatabase(userId);
    this.inFlightRequests.set(userId, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the in-flight request tracking
      this.inFlightRequests.delete(userId);
    }
  }

  /**
   * Internal method to fetch user context from database
   * Separated to enable proper async locking
   */
  private async fetchUserContextFromDatabase(
    userId: string,
  ): Promise<UserContext | null> {
    try {
      // Check if user table exists without creating it
      const tableName = this.clickhouse.getUserTableName(userId);
      const userDatabase = this.clickhouse.config.userDatabase || "user_events";

      // Check if table actually exists in ClickHouse
      const checkQuery =
        `SELECT 1 FROM system.tables WHERE database = '${userDatabase}' AND name = '${tableName}' LIMIT 1`;
      const result = await this.clickhouse.queryDatabaseJSON(
        "system",
        checkQuery,
      );

      if (result.length > 0) {
        const context: UserContext = {
          userId,
          tableName,
          database: userDatabase,
        };

        // Cache the context
        this.contextCache.set(userId, context);

        return context;
      }

      return null;
    } catch (error) {
      console.error(`Error checking user context for '${userId}':`, error);
      return null;
    }
  }

  /**
   * Clears the context cache
   * Useful for testing or when you want to force fresh lookups
   */
  clearCache(): void {
    this.contextCache.clear();
  }

  /**
   * Removes a specific user's context from the cache
   */
  clearUserCache(userId: string): void {
    this.contextCache.delete(userId);
  }

  /**
   * Gets all cached user contexts
   * Useful for debugging or administrative operations
   */
  getCachedContexts(): UserContext[] {
    return Array.from(this.contextCache.values());
  }

  /**
   * Gets the number of cached contexts
   */
  getCacheSize(): number {
    return this.contextCache.size;
  }
}
