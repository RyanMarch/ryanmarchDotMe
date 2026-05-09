export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    // If the asset isn't found (404), serve index.html instead
    if (response.status === 404) {
      const indexRequest = new Request(new URL('/index.html', url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return response;
  }
};
