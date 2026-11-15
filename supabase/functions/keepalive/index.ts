// supabase/functions/keepalive/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request): Promise<Response> => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const start = Date.now();

    // Requête légère pour garder la DB active
    const { error } = await supabase.rpc("keepalive_ping");

    if (error) throw error;

    const duration = Date.now() - start;
    console.log(`[keepalive] ✅ pong — ${duration}ms`);

    return new Response(
      JSON.stringify({ ok: true, duration_ms: duration, ts: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[keepalive] ❌", message);

    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
