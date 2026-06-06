/// <reference lib="deno.ns" />

export interface EventData {
  id?: string;
  timestamp?: string | Date;
  data: Record<string, any>;
  source?: string;
  ip?: string;
  user_agent?: string;
}

export interface ClickHouseConfig {
  host: string;
  port: number;
  // Legacy properties for backward compatibility
  database?: string;
  tableName?: string;
  // New properties for user separation
  systemDatabase?: string; // For system tables
  userDatabase?: string; // For user-specific tables
  username: string;
  password: string;
  tablePrefix?: string; // Default: "events_user"
}

export interface UserTableConfig {
  userId: string;
  tableName: string;
  database: string;
}

export interface UserContext {
  userId: string;
  tableName: string;
  database: string;
}

export interface DashboardStats {
  totalEvents: number;
  eventsToday: number;
  eventsLastHour: number;
  dataSize: string;
  recentEvents: EventData[];
}

// Authentication types
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key?: string; // Only returned on creation
  created_at: string;
  last_used_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

// Request/Response types for authentication
export interface CreateUserRequest {
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface CreateApiKeyRequest {
  name?: string;
}

export interface UpdateApiKeyRequest {
  name: string;
}

// Authentication response types
export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
}

export interface ApiKeyResponse {
  success: boolean;
  message?: string;
  apiKey?: ApiKey;
}

export interface ApiKeysListResponse {
  success: boolean;
  message?: string;
  apiKeys?: Omit<ApiKey, "key">[];
}

// Middleware state for authentication
export interface AuthState {
  user?: User;
  session?: Session;
}

// Database row types (internal use)
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  created_at: string;
  last_used_at?: string;
}

export function getClickHouseConfig(): ClickHouseConfig {
  const config = {
    host: Deno.env.get("CLICKHOUSE_HOST") || "localhost",
    port: parseInt(Deno.env.get("CLICKHOUSE_PORT") || "8123"),
    systemDatabase: Deno.env.get("CLICKHOUSE_SYSTEM_DATABASE") || "default",
    userDatabase: Deno.env.get("CLICKHOUSE_USER_DATABASE") || "user_events",
    username: Deno.env.get("CLICKHOUSE_USER") || "default",
    password: Deno.env.get("CLICKHOUSE_PASSWORD") || "",
    tablePrefix: Deno.env.get("CLICKHOUSE_TABLE_PREFIX") || "events_user",
  };

  if (Deno.env.get("DEBUG") === "true") {
    console.debug("ClickHouse config:", config);
  }
  return config;
}
