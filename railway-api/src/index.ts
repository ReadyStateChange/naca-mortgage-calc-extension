import { testConnection } from "./services/db";
import { getRates } from "./routes/rates";
import { msaLookup } from "./routes/msaLookup";
import { handleCORS } from "./utils/cors";

const PORT = process.env.PORT || 3000;

// Initialize database connection
await testConnection();

// Main Bun server
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    const url = new URL(req.url);
    const path = url.pathname;

    // Route: GET /api/rates
    if (path === "/api/rates" && req.method === "GET") {
      return getRates();
    }

    // Route: POST /api/msa-lookup
    if (path === "/api/msa-lookup" && req.method === "POST") {
      return msaLookup(req);
    }

    // Route: GET / (health check)
    if (path === "/" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "NACA Calculator API",
          version: "1.0.0",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 404 for unknown routes
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Server running on http://localhost:${PORT}`);
