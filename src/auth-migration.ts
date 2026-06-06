import { ClickHouseService } from './clickhouse.ts';
import { ClickHouseConfig } from './types.ts';

/**
 * AuthMigrationService handles database schema migrations for user authentication
 * Creates and manages users, api_keys tables and updates existing events table
 */
export class AuthMigrationService {
  private clickhouse: ClickHouseService;
  private config: ClickHouseConfig;

  constructor(clickhouse: ClickHouseService) {
    this.clickhouse = clickhouse;
    this.config = clickhouse.config;
  }

  /**
   * Run all authentication-related migrations
   */
  async runAuthMigrations(): Promise<void> {
    console.log('Starting authentication database migrations...');

    try {
      await this.createUsersTable();
      await this.createApiKeysTable();
      await this.updateEventsTableWithUserId();

      console.log('Authentication migrations completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Authentication migration failed: ${errorMessage}`);
    }
  }

  /**
   * Create the users table for storing user accounts
   */
  async createUsersTable(): Promise<void> {
    const systemDatabase =
      this.config.systemDatabase || this.config.database || 'default';

    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS ${systemDatabase}.users (
        id String DEFAULT generateUUIDv4(),
        email String,
        password_hash String,
        created_at DateTime DEFAULT now(),
        updated_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY id
      SETTINGS index_granularity = 8192
    `;

    try {
      await this.clickhouse.queryDatabase(
        systemDatabase,
        createUsersTableQuery
      );
      console.log(
        `Users table created successfully in database '${systemDatabase}'`
      );

      // Create unique index on email for fast lookups and uniqueness enforcement
      const createEmailIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_users_email ON ${systemDatabase}.users (email) TYPE bloom_filter GRANULARITY 1
      `;

      try {
        await this.clickhouse.queryDatabase(
          systemDatabase,
          createEmailIndexQuery
        );
        console.log('Email index created for users table');
      } catch (indexError) {
        // Index creation might fail in some ClickHouse versions, but table creation succeeded
        console.warn(
          'Could not create email index (this is not critical):',
          indexError
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create users table: ${errorMessage}`);
    }
  }

  /**
   * Create the api_keys table for storing user API keys
   */
  async createApiKeysTable(): Promise<void> {
    const systemDatabase =
      this.config.systemDatabase || this.config.database || 'default';

    const createApiKeysTableQuery = `
      CREATE TABLE IF NOT EXISTS ${systemDatabase}.api_keys (
        id String DEFAULT generateUUIDv4(),
        user_id String,
        key_hash String,
        name String DEFAULT '',
        created_at DateTime DEFAULT now(),
        last_used_at Nullable(DateTime)
      )
      ENGINE = MergeTree()
      ORDER BY (user_id, id)
      SETTINGS index_granularity = 8192
    `;

    try {
      await this.clickhouse.queryDatabase(
        systemDatabase,
        createApiKeysTableQuery
      );
      console.log(
        `API keys table created successfully in database '${systemDatabase}'`
      );

      // Create index on key_hash for fast API key validation
      const createKeyHashIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON ${systemDatabase}.api_keys (key_hash) TYPE bloom_filter GRANULARITY 1
      `;

      try {
        await this.clickhouse.queryDatabase(
          systemDatabase,
          createKeyHashIndexQuery
        );
        console.log('Key hash index created for api_keys table');
      } catch (indexError) {
        // Index creation might fail in some ClickHouse versions, but table creation succeeded
        console.warn(
          'Could not create key hash index (this is not critical):',
          indexError
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create api_keys table: ${errorMessage}`);
    }
  }

  /**
   * Update existing events table to include user_id column
   */
  async updateEventsTableWithUserId(): Promise<void> {
    const systemDatabase =
      this.config.systemDatabase || this.config.database || 'default';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const tableName = (this.config as any).tableName || 'events';

    try {
      // Check if user_id column already exists
      const checkColumnQuery = `
        SELECT name 
        FROM system.columns 
        WHERE database = '${systemDatabase}' 
        AND table = '${tableName}' 
        AND name = 'user_id'
      `;

      const existingColumns = await this.clickhouse.queryDatabaseJSON(
        'system',
        checkColumnQuery
      );

      if (existingColumns.length > 0) {
        console.log(`Column 'user_id' already exists in table '${tableName}'`);
        return;
      }

      // Add user_id column to existing events table
      const addColumnQuery = `
        ALTER TABLE ${systemDatabase}.${tableName} 
        ADD COLUMN IF NOT EXISTS user_id Nullable(String)
      `;

      await this.clickhouse.queryDatabase(systemDatabase, addColumnQuery);
      console.log(`Added 'user_id' column to events table '${tableName}'`);

      // Create index on user_id for efficient user-specific queries
      const createUserIdIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_events_user_id ON ${systemDatabase}.${tableName} (user_id) TYPE bloom_filter GRANULARITY 1
      `;

      try {
        await this.clickhouse.queryDatabase(
          systemDatabase,
          createUserIdIndexQuery
        );
        console.log('User ID index created for events table');
      } catch (indexError) {
        // Index creation might fail in some ClickHouse versions, but column addition succeeded
        console.warn(
          'Could not create user_id index (this is not critical):',
          indexError
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to update events table with user_id column: ${errorMessage}`
      );
    }
  }

  /**
   * Verify that all authentication tables exist and have correct schema
   */
  async verifyAuthSchema(): Promise<{
    usersTableExists: boolean;
    apiKeysTableExists: boolean;
    eventsHasUserId: boolean;
    errors: string[];
  }> {
    const systemDatabase =
      this.config.systemDatabase || this.config.database || 'default';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const tableName = (this.config as any).tableName || 'events';
    const errors: string[] = [];

    let usersTableExists = false;
    let apiKeysTableExists = false;
    let eventsHasUserId = false;

    try {
      // Check users table
      const usersTableQuery = `
        SELECT 1 FROM system.tables 
        WHERE database = '${systemDatabase}' AND name = 'users' 
        LIMIT 1
      `;
      const usersResult = await this.clickhouse.queryDatabaseJSON(
        'system',
        usersTableQuery
      );
      usersTableExists = usersResult.length > 0;

      if (!usersTableExists) {
        errors.push('Users table does not exist');
      }

      // Check api_keys table
      const apiKeysTableQuery = `
        SELECT 1 FROM system.tables 
        WHERE database = '${systemDatabase}' AND name = 'api_keys' 
        LIMIT 1
      `;
      const apiKeysResult = await this.clickhouse.queryDatabaseJSON(
        'system',
        apiKeysTableQuery
      );
      apiKeysTableExists = apiKeysResult.length > 0;

      if (!apiKeysTableExists) {
        errors.push('API keys table does not exist');
      }

      // Check events table has user_id column
      const eventsColumnQuery = `
        SELECT name 
        FROM system.columns 
        WHERE database = '${systemDatabase}' 
        AND table = '${tableName}' 
        AND name = 'user_id'
      `;
      const eventsColumnResult = await this.clickhouse.queryDatabaseJSON(
        'system',
        eventsColumnQuery
      );
      eventsHasUserId = eventsColumnResult.length > 0;

      if (!eventsHasUserId) {
        errors.push(`Events table '${tableName}' does not have user_id column`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Schema verification failed: ${errorMessage}`);
    }

    return {
      usersTableExists,
      apiKeysTableExists,
      eventsHasUserId,
      errors,
    };
  }

  /**
   * Drop all authentication tables (use with caution - for testing/rollback only)
   */
  async dropAuthTables(): Promise<void> {
    const systemDatabase =
      this.config.systemDatabase || this.config.database || 'default';

    console.warn(
      'Dropping authentication tables - this will delete all user data!'
    );

    try {
      // Drop api_keys table first (has foreign key reference to users)
      await this.clickhouse.queryDatabase(
        systemDatabase,
        `DROP TABLE IF EXISTS ${systemDatabase}.api_keys`
      );
      console.log('Dropped api_keys table');

      // Drop users table
      await this.clickhouse.queryDatabase(
        systemDatabase,
        `DROP TABLE IF EXISTS ${systemDatabase}.users`
      );
      console.log('Dropped users table');

      // Note: We don't drop the user_id column from events table as it might contain data
      console.log('Authentication tables dropped successfully');
      console.warn(
        'Note: user_id column in events table was not removed to preserve data'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to drop authentication tables: ${errorMessage}`);
    }
  }
}
