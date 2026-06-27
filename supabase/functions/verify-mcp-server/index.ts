import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: boolean | { listChanged?: boolean };
    resources?: boolean | { subscribe?: boolean; listChanged?: boolean };
    prompts?: boolean | { listChanged?: boolean };
    sampling?: boolean;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

interface MCPToolsListResponse {
  tools: MCPTool[];
}

async function sendMCPRequest(
  serverUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  authConfig: Record<string, unknown> = {},
  authType: string = 'none'
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Apply authentication
  if (authType === 'api_key' && authConfig.api_key) {
    headers['X-API-Key'] = String(authConfig.api_key);
  } else if (authType === 'bearer' && authConfig.bearer_token) {
    headers['Authorization'] = `Bearer ${authConfig.bearer_token}`;
  } else if (authType === 'basic' && authConfig.username) {
    const credentials = btoa(`${authConfig.username}:${authConfig.password || ''}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const requestBody = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };

  const response = await fetch(serverUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'MCP request failed');
  }

  return data.result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { server_id } = requestBody;

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get server configuration
    const { data: server, error: serverError } = await supabaseClient
      .from('mcp_servers')
      .select('*')
      .eq('id', server_id)
      .single()

    if (serverError || !server) {
      throw new Error('MCP server not found')
    }

    const { server_url, transport_type, auth_type, auth_config } = server

    // Only HTTP transport is currently supported for verification
    if (transport_type !== 'http') {
      // For non-HTTP transports, we can't verify directly but mark as not verified
      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: false,
          error_message: `Transport type '${transport_type}' requires local verification`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: false,
          tools: [],
          error: `Transport type '${transport_type}' cannot be verified remotely`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let tools: MCPTool[] = []
    let capabilities = {
      tools: true,
      resources: false,
      prompts: false,
      sampling: false,
    }

    try {
      // Step 1: Initialize connection
      const initResult = await sendMCPRequest(
        server_url,
        'initialize',
        {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'SJ Control Tower',
            version: '1.0.0',
          },
        },
        auth_config,
        auth_type
      ) as MCPInitializeResponse

      // Extract capabilities
      if (initResult.capabilities) {
        capabilities = {
          tools: !!initResult.capabilities.tools,
          resources: !!initResult.capabilities.resources,
          prompts: !!initResult.capabilities.prompts,
          sampling: !!initResult.capabilities.sampling,
        }
      }

      // Step 2: Send initialized notification
      await sendMCPRequest(
        server_url,
        'notifications/initialized',
        {},
        auth_config,
        auth_type
      )

      // Step 3: List tools if available
      if (capabilities.tools) {
        const toolsResult = await sendMCPRequest(
          server_url,
          'tools/list',
          {},
          auth_config,
          auth_type
        ) as MCPToolsListResponse

        tools = toolsResult.tools || []
      }

      // Update server as verified
      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: true,
          last_verified_at: new Date().toISOString(),
          error_message: null,
          available_tools: tools,
          capabilities,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: true,
          tools,
          capabilities,
          serverInfo: (initResult as MCPInitializeResponse).serverInfo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (mcpError: unknown) {
      const errorMessage = mcpError instanceof Error ? mcpError.message : 'Connection failed'

      // Update server with error
      await supabaseClient
        .from('mcp_servers')
        .update({
          is_verified: false,
          last_verified_at: new Date().toISOString(),
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server_id)

      return new Response(
        JSON.stringify({
          verified: false,
          tools: [],
          error: errorMessage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error: unknown) {
    console.error('Verify MCP server error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
