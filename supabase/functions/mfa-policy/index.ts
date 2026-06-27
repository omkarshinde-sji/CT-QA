import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";
import { validateAuth, authErrorResponse, type AuthError } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "get_policy";

    if (action === "get_policy") {
      // Any authenticated user may read the policy — needed to enforce the grace gate client-side.
      try {
        await validateAuth(req, userClient);
      } catch (err) {
        return authErrorResponse(err as AuthError, corsHeaders);
      }

      const { data, error } = await serviceClient
        .from("mfa_policies")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ policy: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_policy") {
      const authResult = await requirePermission(req, userClient, corsHeaders, "org.manage_mfa_policy");
      if (authResult instanceof Response) return authResult;
      const { userId } = authResult;

      const { required, grace_period_days, allowed_factors, trust_idp_mfa } = body;

      if (typeof required !== "boolean") {
        return new Response(JSON.stringify({ error: "required (boolean) is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        grace_period_days !== undefined &&
        (typeof grace_period_days !== "number" || grace_period_days < 0 || grace_period_days > 90)
      ) {
        return new Response(JSON.stringify({ error: "grace_period_days must be between 0 and 90" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: previous } = await serviceClient
        .from("mfa_policies")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT)
        .single();

      const { data: updated, error: updateError } = await serviceClient
        .from("mfa_policies")
        .update({
          required,
          ...(grace_period_days !== undefined ? { grace_period_days } : {}),
          ...(Array.isArray(allowed_factors) ? { allowed_factors } : {}),
          ...(typeof trust_idp_mfa === "boolean" ? { trust_idp_mfa } : {}),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", DEFAULT_TENANT)
        .select()
        .single();

      if (updateError) throw updateError;

      // When enforcement is turned on, stamp a grace deadline for everyone not yet enrolled.
      if (required && !previous?.required) {
        const graceDays = updated.grace_period_days ?? 7;
        const graceEndsAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString();

        const { data: profiles } = await serviceClient.from("profiles").select("id");
        const { data: enrolled } = await serviceClient
          .from("mfa_enrollment_status")
          .select("user_id")
          .eq("enrolled", true);
        const enrolledIds = new Set((enrolled ?? []).map((e) => e.user_id));

        const rows = (profiles ?? [])
          .filter((p) => !enrolledIds.has(p.id))
          .map((p) => ({ user_id: p.id, grace_period_ends_at: graceEndsAt }));

        if (rows.length) {
          await serviceClient.from("mfa_enrollment_status").upsert(rows, { onConflict: "user_id" });
        }
      }

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action:
          previous?.required === required
            ? "mfa_policy.updated"
            : required
            ? "mfa_policy.enabled"
            : "mfa_policy.disabled",
        resource_type: "mfa_policy",
        resource_id: updated.id,
        details: { previous, updated },
      });

      return new Response(JSON.stringify({ policy: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mfa-policy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
