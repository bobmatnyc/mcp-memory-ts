/**
 * MCP (Model Context Protocol) types and interfaces
 */

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP specific types
export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Error codes
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

// MCP method names
export enum MCPMethod {
  INITIALIZE = 'initialize',
  INITIALIZED = 'initialized',
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  PING = 'ping',
  NOTIFICATIONS_CANCELLED = 'notifications/cancelled',
}

// Tool parameter schemas
export interface AddMemoryParams {
  title: string;
  content: string;
  memory_type?: string;
  importance?: number;
  tags?: string[];
  entity_ids?: number[];
}

export interface SearchMemoriesParams {
  query: string;
  limit?: number;
  threshold?: number;
  memory_types?: string[];
}

export interface CreateEntityParams {
  name: string;
  entity_type: string;
  description?: string;
  importance?: number;
  tags?: string[];
  [key: string]: any;
}

export interface SearchEntitiesParams {
  query: string;
  limit?: number;
}

export interface UnifiedSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  memory_types?: string[];
  entity_types?: string[];
}

export interface DeleteMemoryParams {
  memory_id: number | string;
}

export interface UpdateEntityParams {
  entity_id: number | string;
  updates: Record<string, any>;
}
