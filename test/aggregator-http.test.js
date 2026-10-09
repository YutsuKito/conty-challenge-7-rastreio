import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {HttpAggregator} from '../src/aggregator.js';
import {createService} from '../src/service.js';

async function fixture(handler, run) {
  const server=createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {await run(`http://127.0.0.1:${server.address().port}`);}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('cliente HTTP registra código e sincroniza payload bruto sem regressão ou duplicatas', async()=>{
  const requests=[];
  await fixture(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    requests.push({method:req.method,path:req.url,body:body?JSON.parse(body):null});
    res.setHeader('content-type','application/json');
    if(req.method==='POST'){res.writeHead(204);res.end();return;}
    res.end(JSON.stringify({events:[
      {event_id:'new',status:'DELIVERED',occurred_at:'2026-10-05T12:00:00Z'},
      {event_id:'old',status:'IN_TRANSIT',occurred_at:'2026-10-01T12:00:00Z'},
      {event_id:'unknown',status:'ALIEN_STATUS',occurred_at:'2026-10-06T12:00:00Z'},
    ]}));
  },async baseUrl=>{
    const service=createService({aggregator:new HttpAggregator({baseUrl}),now:()=>new Date('2026-10-09T12:00:00Z')});
    await service.register({tracking_code:'A/B ?'});
    assert.equal((await service.sync('A/B ?')).status,'delivered');
    const result=await service.sync('A/B ?');
    assert.equal(result.events.length,3);assert.equal(result.delayed,false);
    assert.equal(result.events.at(-1).normalized_status,'unknown');
    assert.deepEqual(requests[0],{method:'POST',path:'/tracking',body:{tracking_code:'A/B ?'}});
    assert.equal(requests[1].path,'/tracking/A%2FB%20%3F/events');
  });
});
test('cliente HTTP propaga falha do agregador sem registrar envio',async()=>{
  await fixture((_req,res)=>{res.writeHead(503);res.end('unavailable');},async baseUrl=>{
    const service=createService({aggregator:new HttpAggregator({baseUrl})});
    await assert.rejects(()=>service.register({tracking_code:'A'}),{status:502});
    assert.throws(()=>service.get('A'),{status:404});
  });
});
test('cliente HTTP rejeita JSON e eventos inválidos sem inserir histórico parcial',async()=>{
  for(const body of ['invalid',JSON.stringify({events:[{event_id:'valid',status:'SHIPPED',occurred_at:'2026-10-01'}, {event_id:'invalid',status:'IN_TRANSIT',occurred_at:'bad'}]})]) {
    await fixture((req,res)=>{if(req.method==='POST'){res.writeHead(204);res.end();}else res.end(body);},async baseUrl=>{
      const service=createService({aggregator:new HttpAggregator({baseUrl})});
      await service.register({tracking_code:'A'});
      await assert.rejects(()=>service.sync('A'),{status:502});
      assert.deepEqual(service.get('A').events,[]);
    });
  }
});
test('cliente HTTP cancela uma resposta que excede o timeout',async()=>{
  await fixture((_req,_res)=>{},async baseUrl=>{
    const adapter=new HttpAggregator({baseUrl,timeoutMs:40});
    await assert.rejects(()=>adapter.events('A'),{status:504});
  });
});
