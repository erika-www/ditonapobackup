// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-key",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate Device API Key from header
  const deviceKey = req.headers.get("x-device-key") || req.headers.get("authorization")?.replace("Bearer ", "");

  // =========================================================================
  // 1. GET: Device Polling Pending Direction Commands
  // =========================================================================
  if (req.method === "GET") {
    if (!deviceKey) {
      return new Response(JSON.stringify({ error: "Missing x-device-key header or Authorization token." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    try {
      // Hash deviceKey using SHA-256
      const encoder = new TextEncoder();
      const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(deviceKey.trim()));
      const keyHash = Array.from(new Uint8Array(keyBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Verify device
      const { data: device, error: deviceErr } = await supabase
        .from("device_keys")
        .select("bus_id, revoked_at")
        .eq("key_hash", keyHash)
        .maybeSingle();

      if (deviceErr || !device || device.revoked_at) {
        return new Response(JSON.stringify({ error: "Unauthorized or revoked device key." }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const url = new URL(req.url);
      const afterId = parseInt(url.searchParams.get("after_id") || "0", 10);

      // Query commands for this bus after cursor
      let query = supabase
        .from("bus_commands")
        .select("id, command_type, direction, created_at")
        .eq("bus_id", device.bus_id)
        .order("id", { ascending: true })
        .limit(20);

      if (afterId > 0) {
        query = query.gt("id", afterId);
      }

      const { data: commands, error: cmdErr } = await query;
      if (cmdErr) throw cmdErr;

      return new Response(
        JSON.stringify({
          success: true,
          bus_id: device.bus_id,
          commands: (commands || []).map((cmd) => ({
            id: cmd.id,
            direction: cmd.direction,
            command_type: cmd.command_type,
            created_at: cmd.created_at,
          })),
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Failed to poll commands", details: err?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // =========================================================================
  // 2. POST: Dispatch Command from Admin / Personnel App
  // =========================================================================
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { bus_id, direction, command_type = "direction" } = body;

      if (!bus_id) {
        return new Response(JSON.stringify({ error: "Missing required field 'bus_id'." }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const normDir = String(direction || "").trim();
      if (!["Northbound", "Southbound"].includes(normDir)) {
        return new Response(JSON.stringify({ error: "Direction must be 'Northbound' or 'Southbound'." }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { data: newCmd, error: insErr } = await supabase
        .from("bus_commands")
        .insert({
          bus_id,
          direction: normDir,
          command_type,
          status: "pending",
        })
        .select()
        .single();

      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({
          success: true,
          command: newCmd,
          message: `Dispatched ${normDir} command to bus ${bus_id}`,
        }),
        { status: 201, headers: corsHeaders }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Failed to dispatch command", details: err?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed. Use GET or POST." }), {
    status: 405,
    headers: corsHeaders,
  });
});
