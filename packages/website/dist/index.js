import { testConnection } from "./services/db";
import { getRates } from "./routes/rates";
import { msaLookup } from "./routes/msaLookup";
import { handleCORS } from "./utils/cors";
import { join } from "path";
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(import.meta.dir, "../public");
// Initialize database connection
await testConnection();
// MIME type mapping
const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};
// Main Bun server
const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        // Handle CORS preflight
        const corsResponse = handleCORS(req);
        if (corsResponse)
            return corsResponse;
        const url = new URL(req.url);
        const path = url.pathname;
        // API Routes - handle these first
        if (path === "/api/rates" && req.method === "GET") {
            return getRates();
        }
        if (path === "/api/msa-lookup" && req.method === "POST") {
            return msaLookup(req);
        }
        // Static file serving
        try {
            // Default to index.html for root path
            let filePath = path === "/" ? "/index.html" : path;
            const fullPath = join(PUBLIC_DIR, filePath);
            // Security: prevent directory traversal
            if (!fullPath.startsWith(PUBLIC_DIR)) {
                return new Response("Forbidden", { status: 403 });
            }
            const file = Bun.file(fullPath);
            const exists = await file.exists();
            if (exists) {
                // Get file extension and MIME type
                const ext = filePath.substring(filePath.lastIndexOf("."));
                const mimeType = MIME_TYPES[ext] || "application/octet-stream";
                return new Response(file, {
                    headers: {
                        "Content-Type": mimeType,
                        "Cache-Control": "public, max-age=3600",
                    },
                });
            }
            // If file not found, try to serve index.html for client-side routing
            if (path !== "/" && !path.startsWith("/api/")) {
                const indexFile = Bun.file(join(PUBLIC_DIR, "index.html"));
                if (await indexFile.exists()) {
                    return new Response(indexFile, {
                        headers: { "Content-Type": "text/html" },
                    });
                }
            }
        }
        catch (error) {
            console.error("Error serving static file:", error);
        }
        // 404 for unknown routes
        return new Response("Not Found", { status: 404 });
    },
});
console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`📁 Serving static files from: ${PUBLIC_DIR}`);
