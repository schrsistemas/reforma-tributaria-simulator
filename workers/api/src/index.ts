export interface Env {
  VERSION: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok', service: 'reforma-tributaria-simulator', version: env.VERSION ?? 'dev' });
    }

    if (request.method === 'GET' && url.pathname === '/api/v1') {
      return json({
        service: 'reforma-tributaria-simulator',
        apiVersion: 'v1',
        capabilities: ['simulation', 'tax-engine', 'split-payment']
      });
    }

    return json({ error: 'NOT_FOUND' }, 404);
  }
};
