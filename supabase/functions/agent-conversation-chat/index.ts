import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, getModel, logUsage, calculateCost } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversationChatRequest {
  conversation_id: string
  agent_id: string
  message: string
  user_id: string
  model_id?: string
  include_rag?: boolean
  max_history?: number
  memory_context?: string
}

function isIntegrationTaskQuery(message: string): boolean {
  const normalized = message.toLowerCase()
  const mentionsTask = /\btasks?\b/.test(normalized)
  const mentionsIntegration = /\b(clickup|click up|activecollab|active collab)\b/.test(normalized)
  return mentionsTask && mentionsIntegration
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const {
      conversation_id,
      agent_id,
      message,
      user_id,
      model_id,
      include_rag = true,
      max_history = 20,
      memory_context = "",
    }: ConversationChatRequest = await req.json()

    // Validate required fields
    if (!conversation_id || !agent_id || !message || !user_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id, agent_id, message, and user_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 1. Get agent configuration
    const { data: agent, error: agentError } = await supabaseClient
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // 2. Get user personalization if exists
    let additionalContext = ''
    const { data: personalization } = await supabaseClient
      .from('user_agent_personalizations')
      .select('additional_prompt, attached_knowledge_files, use_all_knowledge, max_context_files, relevance_threshold')
      .eq('user_id', user_id)
      .eq('agent_id', agent_id)
      .eq('is_enabled', true)
      .single()

    if (personalization?.additional_prompt) {
      additionalContext = personalization.additional_prompt
    }

    // 3. Get RAG context if agent has RAG enabled OR include_rag was explicitly requested
    let ragContext = ''
    let ragResultCount = 0
    let hadClickUpTaskSummary = false
    const integrationTaskQuery = isIntegrationTaskQuery(message)
    const shouldDoRag = agent.rag_enabled === true || include_rag || integrationTaskQuery
    if (shouldDoRag) {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (baseUrl && serviceKey) {
          const ragThreshold = personalization?.relevance_threshold ?? 0.5
          const ragCount = personalization?.max_context_files ?? 8
          const normalizedMessage = message.toLowerCase()
          const isClickUpTaskCountQuery =
            /\bclickup\b/.test(normalizedMessage) &&
            /\btasks?\b/.test(normalizedMessage) &&
            /\b(how many|count|number of|total)\b/.test(normalizedMessage)

          // When agent has rag_enabled, search ALL embeddings (org-wide data like ClickUp tasks)
          // Only scope to user when explicitly not using all knowledge AND agent doesn't have rag_enabled
          const searchUserId = (agent.rag_enabled === true || personalization?.use_all_knowledge) ? null : user_id
          console.log(`RAG search: query="${message.substring(0, 80)}", threshold=${ragThreshold}, count=${ragCount}, rag_enabled=${agent.rag_enabled}, searchUserId=${searchUserId}`)
          const semRes = await fetch(`${baseUrl}/functions/v1/semantic-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              query: message,
              match_threshold: ragThreshold,
              match_count: ragCount,
              entity_type: integrationTaskQuery ? 'task' : null,
              user_id: searchUserId,
            }),
          })
          if (semRes.ok) {
            const semBody = await semRes.json()
            const rawDocs = semBody.results ?? []
            const relevantDocs = integrationTaskQuery
              ? rawDocs.filter((doc: { metadata?: { source?: string } }) => {
                  const source = doc.metadata?.source?.toLowerCase()
                  return source === 'clickup' || source === 'activecollab'
                })
              : rawDocs
            ragResultCount = relevantDocs.length
            console.log(`RAG search returned ${relevantDocs.length} results`)

            let ragSummary = ''
            if (isClickUpTaskCountQuery) {
              const { count: clickUpTaskEmbeddingCount, error: clickUpCountError } = await supabaseClient
                .from('embeddings')
                .select('id', { count: 'exact', head: true })
                .eq('entity_type', 'task')
                .contains('metadata', { source: 'clickup' })

              if (clickUpCountError) {
                console.error('ClickUp task embedding count error:', clickUpCountError)
              } else if (typeof clickUpTaskEmbeddingCount === 'number') {
                hadClickUpTaskSummary = true
                ragSummary = [
                  'RETRIEVED DATA SUMMARY:',
                  `- Total ClickUp task embeddings currently available: ${clickUpTaskEmbeddingCount}`,
                  '- If the user asks how many ClickUp tasks exist, use this exact total in the answer.',
                ].join('\n')
              }
            }

            if (relevantDocs.length > 0 || ragSummary) {
              ragContext = '\n\nRELEVANT CONTEXT (from knowledge base):\nYou MUST answer from the retrieved context below when it is relevant. Treat the retrieved records and summaries as authoritative. If a summary includes an exact total, use that total directly in your answer. Only say the context is insufficient when there is truly no relevant context.\n\n'
                + (ragSummary ? `${ragSummary}\n\n` : '')
                + relevantDocs
                  .map((doc: { content?: string; entity_type?: string; similarity?: number; metadata?: { source?: string } }, i: number) => {
                    const source = doc.metadata?.source ?? doc.entity_type ?? 'unknown'
                    return `[${i + 1}] (${source}, relevance: ${(doc.similarity ?? 0).toFixed(2)})\n${doc.content ?? ''}`
                  })
                  .join('\n\n')
            }
          } else {
            console.warn('RAG semantic search returned non-OK:', semRes.status)
          }
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError)
      }
    }

    // 4. Get conversation history
    const { data: history } = await supabaseClient
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(max_history)

    // 5. Build messages array
    const systemPrompt = [
      agent.system_prompt,
      additionalContext,
      memory_context,
      ragContext,
    ].filter(Boolean).join('\n\n')

    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history
    if (history && history.length > 0) {
      messages.push(...history
        .filter((h: any) => h.role !== 'system')
        .map((h: any) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        }))
      )
    }

    // Add current user message
    messages.push({ role: 'user', content: message })

    // 6. Get provider config from agent or use defaults
    const providerConfig = agent.provider_config || {}
    const temperature = providerConfig.temperature ?? 0.7
    const maxTokens = providerConfig.max_tokens ?? 2000

    // 7. Call AI provider
    const response = await chatCompletion(
      supabaseClient,
      {
        messages,
        max_tokens: maxTokens,
        temperature,
      },
      model_id
    )

    const latency = Date.now() - startTime

    // 8. Get the model for cost calculation and logging
    const model = await getModel(supabaseClient, model_id, 'chat')
    if (!model) {
      throw new Error('Model not found')
    }

    // 9. Calculate cost
    const cost = calculateCost(model, response.input_tokens, response.output_tokens, 0)

    // 10. Log usage
    await logUsage(
      supabaseClient,
      user_id,
      model.id,
      'agent-conversation-chat',
      response.input_tokens,
      response.output_tokens,
      0,
      cost
    )

    // 11. Update agent usage count
    await supabaseClient
      .from('ai_agents')
      .update({ usage_count: (agent.usage_count || 0) + 1 })
      .eq('id', agent_id)

    return new Response(
      JSON.stringify({
        response: response.content,
        model_used: response.model,
        provider_used: model.ai_providers?.slug || 'unknown',
        tokens_input: response.input_tokens,
        tokens_output: response.output_tokens,
        latency_ms: latency,
        estimated_cost: cost,
        citations: [], // TODO: Extract citations from RAG context
        metadata: {
          conversation_id,
          agent_id,
          had_rag_context: ragContext.length > 0,
          rag_result_count: ragResultCount,
          had_clickup_task_summary: hadClickUpTaskSummary,
          history_count: history?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Agent conversation chat error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
