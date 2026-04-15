import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "no key" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
  const data = await resp.json();

  // Filter for image-capable models
  const models = (data.models || [])
    .filter((m: any) => {
      const name = (m.name || "").toLowerCase();
      const methods = m.supportedGenerationMethods || [];
      return name.includes("image") || name.includes("imagen") || methods.includes("predict");
    })
    .map((m: any) => ({
      name: m.name,
      displayName: m.displayName,
      methods: m.supportedGenerationMethods,
      outputModalities: m.supportedGenerationMethods,
    }));

  return new Response(JSON.stringify({ total: (data.models || []).length, imageModels: models }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
