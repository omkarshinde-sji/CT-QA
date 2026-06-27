import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth, authErrorResponse } from "./auth-middleware.ts";
import { GenerateRequestSchema, resolvePrNumbers } from "./types/qa-report.types.ts";
import { generateQaReport } from "./services/qa-generation.service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const auth = await validateAuth(req, supabase);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: parsed.error.errors.map((e) => e.message),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[testpilot-generate] request", {
      repo: parsed.data.repo,
      prNumbers: resolvePrNumbers(parsed.data),
      hasTaskTitle: Boolean(parsed.data.taskTitle?.trim()),
      regenerate: parsed.data.regenerate ?? false,
    });

    const result = await generateQaReport(supabase, parsed.data, auth.user.id);

    return new Response(
      JSON.stringify({
        success: result.success,
        report: result.report,
        cached: result.cached,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && "code" in error) {
      return authErrorResponse(error as { status: number; code: string; message: string }, corsHeaders);
    }

    console.error("[testpilot-generate] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
