/**
 * Execute MCP Tool Edge Function - Enhanced for Tool Orchestration
 *
 * Supports:
 * - Dynamic tool discovery and execution
 * - Parameter validation against JSON Schema
 * - Integration with agent_execution_steps for multi-step workflows
 * - Error handling and automatic retries
 * - Tool chaining and parallel execution tracking
 * - Internal Control Tower tools + external MCP servers
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

interface ToolExecutionRequest {
  // Support both old format (tool_name + server_id) and new format (tool_id)
  tool_id?: string;
  tool_name?: string;
  server_id?: string;
  // Parameters
  tool_input?: Record<string, any>;
  input_parameters?: Record<string, any>;
  // Context
  agent_id?: string;
  plan_id?: string;
  step_id?: string;
  conversation_id?: string;
  message_id?: string;
  user_id?: string;
  execution_context?: Record<string, any>;
}

/**
 * Validate tool input parameters against JSON Schema
 */
function validateToolInput(
  input: Record<string, any>,
  schema: Record<string, any>
): string | null {
  const { properties, required } = schema;

  if (!properties) {
    return null; // No validation needed
  }

  // Check required fields
  if (required && Array.isArray(required)) {
    for (const field of required) {
      if (!(field in input)) {
        return `Missing required field: ${field}`;
      }
    }
  }

  // Basic type checking
  for (const [key, value] of Object.entries(input)) {
    const propSchema = properties[key];
    if (!propSchema) {
      continue; // Allow extra fields
    }

    const expectedType = propSchema.type;
    const actualType = typeof value;

    if (expectedType === 'string' && actualType !== 'string') {
      return `Field '${key}' must be a string`;
    }
    if (expectedType === 'number' && actualType !== 'number') {
      return `Field '${key}' must be a number`;
    }
    if (expectedType === 'boolean' && actualType !== 'boolean') {
      return `Field '${key}' must be a boolean`;
    }
    if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      return `Field '${key}' must be an object`;
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      return `Field '${key}' must be an array`;
    }

    // Validate enum values
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      return `Field '${key}' must be one of: ${propSchema.enum.join(', ')}`;
    }
  }

  return null;
}

/**
 * Execute internal Control Tower tools
 * These call existing Control Tower APIs
 */
async function executeInternalTool(
  toolName: string,
  parameters: Record<string, any>,
  supabaseClient: any,
  userId: string
): Promise<any> {
  // TODO: Integrate with actual Control Tower APIs
  // For now returning mock responses

  switch (toolName) {
    case 'create_task':
      return {
        success: true,
        task_id: crypto.randomUUID(),
        message: `Task "${parameters.title}" created successfully`,
      };

    case 'search_tasks':
      return {
        success: true,
        tasks: [],
        count: 0,
        message: 'Search completed',
      };

    case 'update_task':
      return {
        success: true,
        message: 'Task updated successfully',
      };

    case 'schedule_meeting':
      return {
        success: true,
        meeting_id: crypto.randomUUID(),
        meeting_url: 'https://zoom.us/j/123456789',
        message: `Meeting "${parameters.title}" scheduled`,
      };

    case 'get_meeting_transcript':
      return {
        success: true,
        transcript: 'Meeting transcript not available yet',
        summary: 'No summary available',
        message: 'Transcript retrieved',
      };

    case 'search_knowledge':
      return {
        success: true,
        results: [],
        count: 0,
        message: 'Knowledge search completed',
      };

    case 'create_knowledge_article':
      return {
        success: true,
        article_id: crypto.randomUUID(),
        message: `Article "${parameters.title}" created`,
      };

    case 'create_deal':
      return {
        success: true,
        deal_id: crypto.randomUUID(),
        message: `Deal "${parameters.title}" created`,
      };

    case 'search_contacts':
      return {
        success: true,
        contacts: [],
        count: 0,
        message: 'Contact search completed',
      };

    case 'create_project':
      return {
        success: true,
        project_id: crypto.randomUUID(),
        message: `Project "${parameters.name}" created`,
      };

    case 'get_project_status':
      return {
        success: true,
        status: 'on_track',
        health_score: 85,
        message: 'Project status retrieved',
      };

    default:
      throw new Error(`Unknown internal tool: ${toolName}`);
  }
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

    const requestData: ToolExecutionRequest = await req.json()

    // Support both old format (tool_name + server_id) and new format (tool_id)
    const parameters = requestData.input_parameters || requestData.tool_input || {}

    let toolId = requestData.tool_id
    let serverId = requestData.server_id
    let toolName = requestData.tool_name
    let toolSchema: any = null
    let server: any = null

    // If tool_id is provided, fetch tool and server details
    if (toolId) {
      const { data: tool, error: toolError } = await supabaseClient
        .from('mcp_tools')
        .select('*, server:mcp_servers(*)')
        .eq('id', toolId)
        .single()

      if (toolError || !tool) {
        return new Response(
          JSON.stringify({ error: 'Tool not found or not accessible' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      toolName = tool.name
      toolSchema = tool.input_schema
      server = tool.server
      serverId = tool.server_id
    } else if (serverId && toolName) {
      // Old format: fetch server and optionally tool schema
      const { data: serverData, error: serverError } = await supabaseClient
        .from('mcp_servers')
        .select('*')
        .eq('id', serverId)
        .single()

      if (serverError || !serverData) {
        return new Response(
          JSON.stringify({ error: 'MCP server not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      server = serverData

      // Try to fetch tool schema for validation
      const { data: toolData } = await supabaseClient
        .from('mcp_tools')
        .select('input_schema')
        .eq('server_id', serverId)
        .eq('name', toolName)
        .single()

      if (toolData) {
        toolSchema = toolData.input_schema
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Either tool_id or (server_id + tool_name) required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!requestData.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if server is enabled
    if (!server.is_enabled && server.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'MCP server is not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Validate input parameters against schema
    if (toolSchema) {
      const validationError = validateToolInput(parameters, toolSchema)
      if (validationError) {
        return new Response(
          JSON.stringify({ error: `Invalid input: ${validationError}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Create execution record (support both old and new table structures)
    const executionInsert: any = {
      server_id: serverId,
      agent_id: requestData.agent_id || null,
      user_id: requestData.user_id,
      status: 'running',
      started_at: new Date().toISOString(),
    }

    // New format fields
    if (toolId) {
      executionInsert.tool_id = toolId
      executionInsert.input_parameters = parameters
      executionInsert.execution_context = requestData.execution_context || {}
    }

    // Old format fields (for backward compatibility)
    if (requestData.conversation_id) {
      executionInsert.conversation_id = requestData.conversation_id
    }
    if (requestData.message_id) {
      executionInsert.message_id = requestData.message_id
    }
    if (toolName) {
      executionInsert.tool_name = toolName
      executionInsert.tool_input = parameters
    }

    const { data: execution, error: insertError } = await supabaseClient
      .from('mcp_tool_executions')
      .insert(executionInsert)
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create execution record:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create execution record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const startTime = Date.now()

    try {
      let result: any

      // Check if this is an internal Control Tower tool
      if (server.server_url.startsWith('internal://')) {
        result = await executeInternalTool(
          toolName!,
          parameters,
          supabaseClient,
          requestData.user_id
        )
      } else {
        // Execute external MCP tool
        const mcpResult = await sendMCPRequest(
          server.server_url,
          'tools/call',
          {
            name: toolName,
            arguments: parameters,
          },
          server.auth_config || {},
          server.auth_type || 'none'
        ) as MCPToolCallResponse

        // Process the result
        if (mcpResult.content && Array.isArray(mcpResult.content)) {
          const textContent = mcpResult.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n')

          result = {
            raw: mcpResult,
            text: textContent || null,
            hasError: mcpResult.isError || false,
          }
        } else {
          result = mcpResult
        }
      }

      const executionTime = Date.now() - startTime

      // Update execution record with success (support both field names)
      const updateFields: any = {
        status: 'success',
        completed_at: new Date().toISOString(),
      }

      if (toolId) {
        updateFields.output_result = result
        updateFields.execution_time_ms = executionTime
      } else {
        updateFields.tool_output = result
        updateFields.duration_ms = executionTime
      }

      await supabaseClient
        .from('mcp_tool_executions')
        .update(updateFields)
        .eq('id', execution.id)

      // If this is part of a multi-step execution, update the step
      if (requestData.step_id) {
        await supabaseClient
          .from('agent_execution_steps')
          .update({
            status: 'completed',
            result: result,
            output_for_next_step: JSON.stringify(result).slice(0, 1000),
            completed_at: new Date().toISOString(),
            execution_time_ms: executionTime,
          })
          .eq('id', requestData.step_id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          execution_id: execution.id,
          output: result,
          execution_time_ms: executionTime,
          status: 'success',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (toolError: unknown) {
      const executionTime = Date.now() - startTime
      const errorMessage = toolError instanceof Error ? toolError.message : 'Tool execution failed'

      // Update execution record with failure
      const updateFields: any = {
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }

      if (toolId) {
        updateFields.error_code = 'TOOL_EXECUTION_ERROR'
        updateFields.execution_time_ms = executionTime
      } else {
        updateFields.duration_ms = executionTime
      }

      await supabaseClient
        .from('mcp_tool_executions')
        .update(updateFields)
        .eq('id', execution.id)

      // If this is part of a multi-step execution, check for retries
      if (requestData.step_id) {
        const { data: step } = await supabaseClient
          .from('agent_execution_steps')
          .select('retry_count, max_retries')
          .eq('id', requestData.step_id)
          .single()

        if (step && step.retry_count < step.max_retries) {
          // Mark for retry
          await supabaseClient
            .from('agent_execution_steps')
            .update({
              status: 'pending',
              retry_count: step.retry_count + 1,
              error_message: errorMessage,
            })
            .eq('id', requestData.step_id)
        } else {
          // Max retries exhausted
          await supabaseClient
            .from('agent_execution_steps')
            .update({
              status: 'failed',
              error_message: errorMessage,
              error_code: 'MAX_RETRIES_EXCEEDED',
              completed_at: new Date().toISOString(),
            })
            .eq('id', requestData.step_id)
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          execution_id: execution.id,
          error: errorMessage,
          execution_time_ms: executionTime,
          status: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error: unknown) {
    console.error('Execute MCP tool error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
