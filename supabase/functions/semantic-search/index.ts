import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { performRetrieval, logVectorSearch } from "../_shared/rag-retrieval.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const {
      query,
      match_threshold: bodyThreshold,
      match_count: bodyCount,
      similarity_threshold,
      limit,
      entity_type: bodyEntityType,
      entity_types: bodyEntityTypes,
      user_id,
      source_id,
      project_name,
      project_manager,
      client_name,
      skip_rerank,
    } = body;

    const match_threshold = similarity_threshold ?? bodyThreshold ?? 0.5;
    const match_count = limit ?? bodyCount ?? 10;
    const entity_type =
      bodyEntityType ??
      (Array.isArray(bodyEntityTypes) && bodyEntityTypes.length > 0
        ? bodyEntityTypes[0]
        : null);

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const start = Date.now();
    const retrieval = await performRetrieval(supabaseClient, {
      query,
      match_threshold,
      match_count,
      entity_type,
      user_id,
      source_id,
      project_name,
      project_manager,
      client_name,
      skip_rerank,
    });

    const totalMs = Date.now() - start;
    const topScore = retrieval.results[0]?.rerank_score ?? retrieval.results[0]?.similarity ?? null;

    await logVectorSearch(supabaseClient, {
      user_id,
      query,
      result_count: retrieval.results.length,
      top_score: topScore,
      duration_ms: totalMs,
      metadata: {
        retrieval_latency_ms: retrieval.retrieval_latency_ms,
        rerank_latency_ms: retrieval.rerank_latency_ms,
        reranked: retrieval.reranked,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        results: retrieval.results,
        count: retrieval.results.length,
        retrieval_latency_ms: retrieval.retrieval_latency_ms,
        rerank_latency_ms: retrieval.rerank_latency_ms,
        reranked: retrieval.reranked,
        duration_ms: totalMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Semantic search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
