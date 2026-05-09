export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Try to fetch the original asset
    let response = await env.ASSETS.fetch(request);

    // 2. If it's a 404 and doesn't look like a file (no dot in the last segment)
    //    it's likely a project route, so serve index.html
    if (response.status === 404 && !url.pathname.split('/').pop().includes('.')) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl));
    }

    return response;
  }
};
