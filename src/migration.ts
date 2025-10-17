import { ClickHouseService } from "./clickhouse.ts";
import { ClickHouseConfig, EventData } from "./types.ts";
import { AuthMigrationService } from "./auth-migration.ts";

export interface MigrationResult {
  success: boolean;
  migratedUsers: string[];
  totalEvents: number;
  migratedEvents: number;
  errors: string[];
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  totalEventsInSharedTable: number;
  totalEventsInUserTables: number;
  userTableCounts: Record<string, number>;
  missingEvents: number;
  errors: string[];
}

export interface MigrationProgress {
  currentUser: string;
  processedUsers: number;
  totalUsers: number;
  processedEvents: number;
  totalEvents: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

/**
 * MigrationService handles the migration of data from shared tables to user-specific tables
 * Provides data integrity validation and rollback capabilities
 */
export class MigrationService {
  private clickhouse: ClickHouseService;
  private config: ClickHouseConfig;
  private batchSize: number = 1000;
  private progressCallback?: (progress: MigrationProgress) => void;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
    this.config = clickhouse.config;
  }

  /**
   * Sets the batch size for migration operations
   */
  setBatchSize(size: number): void {
    if (size <= 0) {
      throw new Error("Batch size must be greater than 0");
    }
    this.batchSize = size;
  }

  /**
   * Sets a progress callback function to monitor migration progress
   */
  setProgressCallback(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Main migration method that transfers data from shared table to user-specific tables
   * Preserves all historical events and maintains data integrity
   */
  async migrateToUserTables(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      migratedUsers: [],
      totalEvents: 0,
      migratedEvents: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log(
        "Starting migration from shared table to user-specific tables...",
      );

      // Step 1: Validate prerequisites
      await this.validatePrerequisites();

      // Step 2: Get unique user IDs from shared table
      const userIds = await this.getUniqueUserIds();
      console.log(`Found ${userIds.length} unique users to migrate`);

      if (userIds.length === 0) {
        console.log("No users found in shared table, migration complete");
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Step 3: Get total event count for progress tracking
      result.totalEvents = await this.getTotalEventCount();
      console.log(`Total events to migrate: ${result.totalEvents}`);

      // Step 4: Migrate data for each user
      let processedEvents = 0;
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];

        try {
          console.log(`Migrating user ${i + 1}/${userIds.length}: ${userId}`);

          // Report progress
          if (this.progressCallback) {
            this.progressCallback({
              currentUser: userId,
              processedUsers: i,
              totalUsers: userIds.length,
              processedEvents,
              totalEvents: result.totalEvents,
              startTime,
              estimatedTimeRemaining: this.calculateEstimatedTime(
                startTime,
                i,
                userIds.length,
              ),
            });
          }

          const migratedCount = await this.migrateUserData(userId);
          result.migratedUsers.push(userId);
          processedEvents += migratedCount;
          result.migratedEvents += migratedCount;

          console.log(
            `Successfully migrated ${migratedCount} events for user: ${userId}`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          const userError =
            `Failed to migrate user '${userId}': ${errorMessage}`;
          console.error(userError);
          result.errors.push(userError);
        }
      }

      // Step 5: Validate migration integrity
      console.log("Validating migration integrity...");
      const validation = await this.validateMigration();

      if (!validation.valid) {
        result.errors.push("Migration validation failed");
        result.errors.push(...validation.errors);
        throw new Error("Migration validation failed");
      }

      result.success = true;
      console.log(
        `Migration completed successfully. Migrated ${result.migratedEvents} events for ${result.migratedUsers.length} users`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error("Migration failed:", errorMessage);
      result.errors.push(errorMessage);
      result.success = false;
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validates that all prerequisites for migration are met
   */
  private async validatePrerequisites(): Promise<void> {
    // Check if user database exists
    const userDatabase = this.config.userDatabase || "user_events";
    try {
      await this.clickhouse.queryDatabase(userDatabase, "SELECT 1 LIMIT 1");
    } catch (error) {
      throw new Error(
        `User database '${userDatabase}' is not accessible. Please ensure it exists and is properly configured.`,
      );
    }

    // Check if shared table exists and has user_id column
    const sharedTableName = (this.config as any).tableName || "events";
    const systemDatabase = this.config.systemDatabase || this.config.database ||
      "default";

    try {
      const columns = await this.clickhouse.queryDatabaseJSON(
        "system",
        `SELECT name FROM system.columns WHERE database = '${systemDatabase}' AND table = '${sharedTableName}'`,
      );

      const columnNames = columns.map((col) => col.name);
      if (!columnNames.includes("user_id")) {
        throw new Error(
          `Shared table '${sharedTableName}' does not have a 'user_id' column. Migration requires this column to identify user data.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("user_id")) {
        throw error;
      }
      throw new Error(
        `Cannot access shared table '${sharedTableName}' in database '${systemDatabase}'. Please verify the table exists.`,
      );
    }
  }

  /**
   * Gets unique user IDs from the shared events table
   */
  private async getUniqueUserIds(): Promise<string[]> {
    const sharedTableName = (this.config as any).tableName || "events";
    const systemDatabase = this.config.systemDatabase || this.config.database ||
      "default";

    try {
      const query = `
        SELECT DISTINCT user_id 
        FROM ${systemDatabase}.${sharedTableName} 
        WHERE user_id IS NOT NULL AND user_id != '' 
        ORDER BY user_id
      `;

      const result = await this.clickhouse.queryDatabaseJSON(
        systemDatabase,
        query,
      );
      return result
        .map((row) => row.user_id)
        .filter((id) => id && typeof id === "string");
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to get unique user IDs: ${errorMessage}`);
    }
  }

  /**
   * Gets the total count of events in the shared table
   */
  private async getTotalEventCount(): Promise<number> {
    const sharedTableName = (this.config as any).tableName || "events";
    const systemDatabase = this.config.systemDatabase || this.config.database ||
      "default";

    try {
      const query =
        `SELECT count() as total FROM ${systemDatabase}.${sharedTableName} WHERE user_id IS NOT NULL AND user_id != ''`;
      const result = await this.clickhouse.queryDatabaseJSON(
        systemDatabase,
        query,
      );
      return result[0]?.total || 0;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to get total event count: ${errorMessage}`);
    }
  }

  /**
   * Migrates data for a specific user from shared table to their user-specific table
   */
  private async migrateUserData(userId: string): Promise<number> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    // Ensure user table exists
    await this.clickhouse.ensureUserTable(userId);

    const sharedTableName = (this.config as any).tableName || "events";
    const systemDatabase = this.config.systemDatabase || this.config.database ||
      "default";
    const userTableName = this.clickhouse.getUserTableName(userId);
    const userDatabase = this.config.userDatabase || "user_events";

    let totalMigrated = 0;
    let offset = 0;

    try {
      while (true) {
        // Get batch of events for this user
        // Use parameterized query to prevent SQL injection
        const selectQuery = `
          SELECT id, timestamp, data, source, ip, user_agent, created_at
          FROM ${systemDatabase}.${sharedTableName}
          WHERE user_id = {userId:String}
          ORDER BY timestamp, id
          LIMIT ${this.batchSize} OFFSET ${offset}
        `;

        const events = await this.clickhouse.queryDatabaseJSON(
          systemDatabase,
          selectQuery,
          { userId },
        );

        if (events.length === 0) {
          break; // No more events for this user
        }

        // Insert events into user-specific table
        if (events.length > 0) {
          try {
            // Use the ClickHouse service's insert method by creating a batch insert query
            const insertQuery =
              `INSERT INTO ${userDatabase}.${userTableName} FORMAT JSONEachRow`;
            const eventData = events
              .map((event) =>
                JSON.stringify({
                  id: event.id,
                  timestamp: event.timestamp,
                  data: typeof event.data === "string"
                    ? event.data
                    : JSON.stringify(event.data),
                  source: event.source || "",
                  ip: event.ip || "",
                  user_agent: event.user_agent || "",
                  created_at: event.created_at,
                })
              )
              .join("\n");

            // Use direct HTTP call for batch insert (this is how ClickHouse batch inserts work)
            const url =
              `http://${this.config.host}:${this.config.port}/?query=${
                encodeURIComponent(
                  insertQuery,
                )
              }`;

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...this.getAuthHeaders(),
              },
              body: eventData,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `Failed to insert batch for user '${userId}': ${response.statusText} - ${errorText}`,
              );
            }

            totalMigrated += events.length;
          } catch (error) {
            const errorMessage = error instanceof Error
              ? error.message
              : String(error);
            throw new Error(
              `Failed to insert events for user '${userId}': ${errorMessage}`,
            );
          }
        }

        offset += this.batchSize;
      }

      return totalMigrated;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(
        `Failed to migrate data for user '${userId}': ${errorMessage}`,
      );
    }
  }

  /**
   * Validates the integrity of the migration by comparing event counts
   */
  async validateMigration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: false,
      totalEventsInSharedTable: 0,
      totalEventsInUserTables: 0,
      userTableCounts: {},
      missingEvents: 0,
      errors: [],
    };

    try {
      // Get total events in shared table
      result.totalEventsInSharedTable = await this.getTotalEventCount();

      // Get unique user IDs
      const userIds = await this.getUniqueUserIds();

      // Count events in each user table
      let totalInUserTables = 0;
      for (const userId of userIds) {
        try {
          const userTableName = this.clickhouse.getUserTableName(userId);
          const userDatabase = this.config.userDatabase || "user_events";

          const countQuery =
            `SELECT count() as total FROM ${userDatabase}.${userTableName}`;
          const countResult = await this.clickhouse.queryDatabaseJSON(
            userDatabase,
            countQuery,
          );
          const userEventCount = countResult[0]?.total || 0;

          result.userTableCounts[userId] = userEventCount;
          totalInUserTables += userEventCount;
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          result.errors.push(
            `Failed to count events for user '${userId}': ${errorMessage}`,
          );
        }
      }

      result.totalEventsInUserTables = totalInUserTables;
      result.missingEvents = result.totalEventsInSharedTable -
        result.totalEventsInUserTables;

      // Validation passes if event counts match
      result.valid = result.missingEvents === 0 && result.errors.length === 0;

      if (!result.valid) {
        if (result.missingEvents > 0) {
          result.errors.push(
            `Missing ${result.missingEvents} events in user tables`,
          );
        } else if (result.missingEvents < 0) {
          result.errors.push(
            `Extra ${Math.abs(result.missingEvents)} events in user tables`,
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      result.errors.push(`Validation failed: ${errorMessage}`);
    }

    return result;
  }

  /**
   * Verifies data integrity for a specific user by comparing sample data
   */
  async verifyUserDataIntegrity(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== "string") {
      throw new Error("User ID must be a non-empty string");
    }

    try {
      const sharedTableName = (this.config as any).tableName || "events";
      const systemDatabase = this.config.systemDatabase ||
        this.config.database || "default";
      const userTableName = this.clickhouse.getUserTableName(userId);
      const userDatabase = this.config.userDatabase || "user_events";

      // Get sample of events from shared table
      // Use parameterized query to prevent SQL injection
      const sharedQuery = `
        SELECT id, timestamp, data, source, ip, user_agent
        FROM ${systemDatabase}.${sharedTableName}
        WHERE user_id = {userId:String}
        ORDER BY timestamp, id
        LIMIT 100
      `;

      // Get sample of events from user table
      const userQuery = `
        SELECT id, timestamp, data, source, ip, user_agent
        FROM ${userDatabase}.${userTableName}
        ORDER BY timestamp, id
        LIMIT 100
      `;

      const [sharedEvents, userEvents] = await Promise.all([
        this.clickhouse.queryDatabaseJSON(systemDatabase, sharedQuery, {
          userId,
        }),
        this.clickhouse.queryDatabaseJSON(userDatabase, userQuery),
      ]);

      // Compare sample data
      if (sharedEvents.length !== userEvents.length) {
        console.warn(
          `Sample size mismatch for user '${userId}': shared=${sharedEvents.length}, user=${userEvents.length}`,
        );
        return false;
      }

      for (let i = 0; i < sharedEvents.length; i++) {
        const shared = sharedEvents[i];
        const user = userEvents[i];

        if (
          shared.id !== user.id ||
          shared.timestamp !== user.timestamp ||
          shared.source !== user.source ||
          shared.ip !== user.ip ||
          shared.user_agent !== user.user_agent
        ) {
          console.warn(`Data mismatch for user '${userId}' at index ${i}`);
          return false;
        }

        // Compare data field (handle JSON string vs object)
        const sharedData = typeof shared.data === "string"
          ? shared.data
          : JSON.stringify(shared.data);
        const userData = typeof user.data === "string"
          ? user.data
          : JSON.stringify(user.data);

        if (sharedData !== userData) {
          console.warn(
            `Data field mismatch for user '${userId}' at index ${i}`,
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(
        `Failed to verify data integrity for user '${userId}': ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Rollback migration by dropping all user tables (use with caution)
   */
  async rollbackMigration(): Promise<void> {
    console.warn(
      "Starting migration rollback - this will drop all user tables!",
    );

    try {
      const userIds = await this.getUniqueUserIds();
      const userDatabase = this.config.userDatabase || "user_events";

      for (const userId of userIds) {
        try {
          const userTableName = this.clickhouse.getUserTableName(userId);
          const dropQuery =
            `DROP TABLE IF EXISTS ${userDatabase}.${userTableName}`;
          await this.clickhouse.queryDatabase(userDatabase, dropQuery);
          console.log(`Dropped user table: ${userTableName}`);
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          console.error(
            `Failed to drop table for user '${userId}': ${errorMessage}`,
          );
        }
      }

      console.log("Migration rollback completed");
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Rollback failed: ${errorMessage}`);
    }
  }

  /**
   * Lists all user tables in the user database
   */
  async listUserTables(): Promise<string[]> {
    try {
      const userDatabase = this.config.userDatabase || "user_events";
      const tablePrefix = this.config.tablePrefix || "events_user";

      const query = `
        SELECT name 
        FROM system.tables 
        WHERE database = '${userDatabase}' 
        AND name LIKE '${tablePrefix}_%'
        ORDER BY name
      `;

      const result = await this.clickhouse.queryDatabaseJSON("system", query);
      return result.map((row) => row.name);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      throw new Error(`Failed to list user tables: ${errorMessage}`);
    }
  }

  /**
   * Gets authentication headers for ClickHouse requests
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.username && this.config.password) {
      const credentials = btoa(
        `${this.config.username}:${this.config.password}`,
      );
      headers["Authorization"] = `Basic ${credentials}`;
    } else if (this.config.username) {
      headers["X-ClickHouse-User"] = this.config.username;
      if (this.config.password) {
        headers["X-ClickHouse-Key"] = this.config.password;
      }
    }

    return headers;
  }

  /**
   * Calculates estimated time remaining for migration
   */
  private calculateEstimatedTime(
    startTime: number,
    processed: number,
    total: number,
  ): number | undefined {
    if (processed === 0) return undefined;

    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;

    return remaining / rate;
  }
}
