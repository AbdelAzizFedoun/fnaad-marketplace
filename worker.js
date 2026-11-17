const API_ORIGIN = "https://api-production-167a1dfd.up.railway.app";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── Proxy /media/* → Railway backend ──────────────────────────────────
    // Images are stored on the Railway Django server. The browser blocks them
    // if the response has CORS headers missing or set to `null`, so we fetch
    // them here (server-to-server, no CORS restriction) and re-send with the
    // correct Access-Control-Allow-Origin header.
    if (url.pathname.startsWith("/media/")) {
      // Handle CORS pre-flight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request),
        });
      }

      const apiUrl = API_ORIGIN + url.pathname + url.search;

      let apiResponse;
      try {
        apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: { Accept: "image/*,*/*" },
          // CF Workers follow redirects by default
        });
      } catch (err) {
        return new Response("Media fetch error: " + err.message, {
          status: 502,
        });
      }

      // Build a new response with correct CORS + cache headers
      const newHeaders = new Headers(apiResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      newHeaders.set("Vary", "Origin");
      // Cache media files for 1 hour at the CDN edge
      newHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        headers: newHeaders,
      });
    }

    // ── Serve the SPA, including direct deep links such as /product/11 ────
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    return assetResponse;
  },
};

/** Returns minimal CORS headers for pre-flight responses */
function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
