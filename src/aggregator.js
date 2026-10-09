// Transport adapter. The tracking service depends only on register(code)/events(code).
export class HttpAggregator {
  constructor({baseUrl, fetchImpl=fetch, timeoutMs=3000}={}) {
    const url=new URL(baseUrl);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new TypeError('URL HTTP(S) sem credenciais obrigatória');
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0) throw new TypeError('Timeout positivo obrigatório');
    this.baseUrl=url.href.replace(/\/$/,'');this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;
  }
  async request(path, options={}) {
    try {
      const response=await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...options, headers:{accept:'application/json',...options.headers}, signal:AbortSignal.timeout(this.timeoutMs),
      });
      if(!response.ok) throw Object.assign(new Error(`Agregador respondeu HTTP ${response.status}`),{status:502});
      return response;
    } catch(error) {
      if(error.status) throw error;
      const timedOut=error.name==='TimeoutError'||error.name==='AbortError';
      throw Object.assign(new Error(timedOut?'Timeout do agregador':'Agregador indisponível'),{status:timedOut?504:502});
    }
  }
  async register(code) {
    const response=await this.request('/tracking', {
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tracking_code:code}),
    });
    // Registration can return 201 JSON or 204 without a body.
    await response.body?.cancel();
  }
  async events(code) {
    const response=await this.request(`/tracking/${encodeURIComponent(code)}/events`);
    let payload;
    try {payload=await response.json();}
    catch(error) {
      const timedOut=error.name==='TimeoutError'||error.name==='AbortError';
      throw Object.assign(new Error(timedOut?'Timeout do agregador':'JSON inválido do agregador'),{status:timedOut?504:502});
    }
    if(!payload||!Array.isArray(payload.events)||payload.events.some(event=>
      !event||typeof event.event_id!=='string'||!event.event_id||typeof event.status!=='string'||!event.status||!Number.isFinite(Date.parse(event.occurred_at))
    )) throw Object.assign(new Error('Eventos inválidos do agregador'),{status:502});
    return payload.events.map(({event_id,status,occurred_at})=>({event_id,status,occurred_at}));
  }
}
