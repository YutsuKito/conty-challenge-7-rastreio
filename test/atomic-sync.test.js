import test from 'node:test';
import assert from 'node:assert/strict';
import {createService,FakeAggregator} from '../src/service.js';

const event=(id,status='IN_TRANSIT')=>({event_id:id,status,occurred_at:'2026-10-01T12:00:00Z'});
function setup(){
  const aggregator=new FakeAggregator({A:[]});
  const service=createService({aggregator,now:()=>new Date('2026-10-02T12:00:00Z')});
  return {aggregator,service};
}
test('evento inválido ao fim do lote não grava eventos nem compromete retry',async()=>{
  const {aggregator,service}=setup();await service.register({tracking_code:'A'});
  const before=service.get('A');
  for(const invalid of [{...event('bad'),occurred_at:'invalid'},null]){
    aggregator.data.A=[event('first'),invalid];
    await assert.rejects(()=>service.sync('A'),{status:400});
    assert.deepEqual(service.get('A'),before);
  }
  aggregator.data.A=[event('first'),event('second')];
  assert.equal((await service.sync('A')).events.length,2);
  assert.equal((await service.sync('A')).events.length,2);
});
test('conflito com histórico ao fim do lote preserva o envio inteiro',async()=>{
  const {aggregator,service}=setup();await service.register({tracking_code:'A'});
  aggregator.data.A=[event('existing','DELIVERED')];await service.sync('A');
  const before=service.get('A');
  aggregator.data.A=[event('new'),event('existing','SHIPPED')];
  await assert.rejects(()=>service.sync('A'),{status:409});
  assert.deepEqual(service.get('A'),before);
});
test('conflito dentro do lote não grava nada; duplicata idêntica grava uma vez',async()=>{
  const {aggregator,service}=setup();await service.register({tracking_code:'A'});
  const before=service.get('A');
  aggregator.data.A=[event('first'),event('duplicate'),event('duplicate','SHIPPED')];
  await assert.rejects(()=>service.sync('A'),{status:409});
  assert.deepEqual(service.get('A'),before);
  aggregator.data.A=[event('first'),event('duplicate'),event('duplicate')];
  assert.equal((await service.sync('A')).events.length,2);
});
