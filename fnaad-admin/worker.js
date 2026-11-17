export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    return assetResponse;
  },
};
