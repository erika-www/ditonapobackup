// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// In-memory rate limiting map for edge instances (key -> timestamp)
const rateLimitMap = new Map<string, number>();

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-key",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Authenticate Device API Key
    const deviceKey = req.headers.get("x-device-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!deviceKey) {
      return new Response(JSON.stringify({ error: "Missing x-device-key header or Authorization bearer token." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hash deviceKey using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(deviceKey.trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Initialize Supabase Admin Client using service role environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify key hash against device_keys table
    const { data: device, error: deviceErr } = await supabase
      .from("device_keys")
      .select("bus_id, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (deviceErr || !device) {
      return new Response(JSON.stringify({ error: "Invalid or unauthorized device key." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (device.revoked_at) {
      return new Response(JSON.stringify({ error: "Device key has been revoked." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const assignedBusId = device.bus_id;

    // Rate Limiting: Max 1 request every 1.5 seconds per device
    const now = Date.now();
    const lastReq = rateLimitMap.get(assignedBusId) || 0;
    if (now - lastReq < 1500) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Sending updates too quickly." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
    rateLimitMap.set(assignedBusId, now);

    // 2. Parse and Validate Payload
    const body = await req.json();
    const { latitude, longitude, speed, heading, accuracy, recorded_at } = body;

    if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
      return new Response(JSON.stringify({ error: "Invalid latitude. Must be between -90 and 90." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
      return new Response(JSON.stringify({ error: "Invalid longitude. Must be between -180 and 180." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const recDate = recorded_at ? new Date(recorded_at) : new Date();
    if (isNaN(recDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid recorded_at timestamp." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for out-of-order or stale data against bus_current_location
    const { data: currentLoc } = await supabase
      .from("bus_current_location")
      .select("updated_at")
      .eq("bus_id", assignedBusId)
      .maybeSingle();

    if (currentLoc && currentLoc.updated_at) {
      const currentLocTime = new Date(currentLoc.updated_at).getTime();
      if (recDate.getTime() < currentLocTime - 5000) { // 5s tolerance
        return new Response(JSON.stringify({ error: "Rejected out-of-order stale GPS packet." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 3. Write Historical Record to bus_locations
    const { error: histErr } = await supabase.from("bus_locations").insert([{
      bus_id: assignedBusId,
      latitude,
      longitude,
      speed: speed ?? null,
      heading: heading ?? null,
      accuracy: accuracy ?? null,
      recorded_at: recDate.toISOString(),
    }]);

    if (histErr) {
      throw histErr;
    }

    // 4. Upsert Latest Location to bus_current_location
    const { error: upsertErr } = await supabase.from("bus_current_location").upsert([{
      bus_id: assignedBusId,
      latitude,
      longitude,
      speed: speed ?? null,
      heading: heading ?? null,
      accuracy: accuracy ?? null,
      updated_at: recDate.toISOString(),
    }], { onConflict: "bus_id" });

    if (upsertErr) {
      throw upsertErr;
    }

    return new Response(JSON.stringify({
      success: true,
      bus_id: assignedBusId,
      recorded_at: recDate.toISOString(),
      status: "Location updated successfully",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
