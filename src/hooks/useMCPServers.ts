// MCP Servers hooks - disabled (tables not yet created)
// These hooks will be enabled once mcp_servers table exists

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Types
export type TransportType = "stdio" | "http" | "websocket" | "sse";
export type AuthType = "none" | "api_key" | "bearer" | "oauth" | "basic";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  sampling?: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  server_url: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: Record<string, unknown>;
  available_tools: MCPTool[];
  available_resources: unknown[];
  available_prompts: unknown[];
  capabilities: MCPCapabilities;
  user_id: string | null;
  is_global: boolean;
  is_active: boolean;
  is_verified: boolean;
  last_verified_at: string | null;
  error_message: string | null;
  usage_count: number;
  last_used_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MCPToolExecution {
  id: string;
  server_id: string;
  agent_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  user_id: string;
  tool_name: string;
  tool_input: unknown;
  tool_output: unknown;
  status: "pending" | "executing" | "completed" | "failed" | "timeout";
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMCPServer {
  id: string;
  agent_id: string;
  server_id: string;
  enabled_tools: string[];
  tool_config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  mcp_servers?: MCPServer;
}

export interface CreateMCPServerData {
  name: string;
  description?: string;
  icon?: string;
  server_url: string;
  transport_type: TransportType;
  auth_type?: AuthType;
  auth_config?: Record<string, unknown>;
  available_tools?: MCPTool[];
  capabilities?: Partial<MCPCapabilities>;
}

export interface UpdateMCPServerData extends Partial<CreateMCPServerData> {
  is_active?: boolean;
}

// Stub hooks - tables not yet created
export function useMCPServers() {
  return useQuery({
    queryKey: ["mcp-servers"],
    queryFn: async () => {
      console.warn("MCP Servers table not yet configured");
      return [] as MCPServer[];
    },
  });
}

export function useUserMCPServers() {
  return useQuery({
    queryKey: ["mcp-servers-user"],
    queryFn: async () => [] as MCPServer[],
    enabled: false,
  });
}

export function useGlobalMCPServers() {
  return useQuery({
    queryKey: ["mcp-servers-global"],
    queryFn: async () => [] as MCPServer[],
    enabled: false,
  });
}

export function useMCPServer(_id: string | null) {
  return useQuery({
    queryKey: ["mcp-server-disabled"],
    queryFn: async () => null as MCPServer | null,
    enabled: false,
  });
}

export function useCreateMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_data: CreateMCPServerData) => {
      toast.error("MCP Servers not configured - database table required");
      throw new Error("MCP Servers not enabled");
    },
    onError: (error: Error) => {
      console.error("Error creating MCP server:", error);
    },
  });
}

export function useUpdateMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { id: string; data: UpdateMCPServerData }) => {
      throw new Error("MCP Servers not enabled");
    },
    onError: (error: Error) => {
      console.error("Error updating MCP server:", error);
    },
  });
}

export function useDeleteMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string) => {
      throw new Error("MCP Servers not enabled");
    },
    onError: (error: Error) => {
      console.error("Error deleting MCP server:", error);
    },
  });
}

export function useVerifyMCPServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_id: string) => {
      toast.error("MCP Servers not configured - database table required");
      throw new Error("MCP Servers not enabled");
    },
    onError: (error: Error) => {
      console.error("Error verifying MCP server:", error);
    },
  });
}

export function useAgentMCPServers(_agentId: string | null) {
  return useQuery({
    queryKey: ["agent-mcp-servers-disabled"],
    queryFn: async () => [] as AgentMCPServer[],
    enabled: false,
  });
}

export function useAgentMCPTools(_agentId: string | null) {
  return useQuery({
    queryKey: ["agent-mcp-tools-disabled"],
    queryFn: async () => [] as Array<{ server_id: string; server_name: string; tool: MCPTool }>,
    enabled: false,
  });
}

export function useConnectMCPToAgent() {
  return useMutation({
    mutationFn: async (_params: { agentId: string; serverId: string; enabledTools?: string[] }) => {
      throw new Error("MCP Servers not enabled");
    },
  });
}

export function useDisconnectMCPFromAgent() {
  return useMutation({
    mutationFn: async (_params: { agentId: string; serverId: string }) => {
      throw new Error("MCP Servers not enabled");
    },
  });
}

export function useExecuteMCPTool() {
  return useMutation({
    mutationFn: async (_params: {
      serverId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
      agentId?: string;
      conversationId?: string;
      messageId?: string;
    }) => {
      throw new Error("MCP Servers not enabled");
    },
    onError: (error: Error) => {
      console.error("Error executing MCP tool:", error);
    },
  });
}

export function useMCPToolExecutions(_serverId: string | null, _limit = 50) {
  return useQuery({
    queryKey: ["mcp-tool-executions-disabled"],
    queryFn: async () => [] as MCPToolExecution[],
    enabled: false,
  });
}
