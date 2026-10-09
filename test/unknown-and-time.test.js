import test from 'node:test';import assert from 'node:assert/strict';import {createService,FakeAggregator,normalize} from '../src/service.js';
test('status desconhecidos coincidentes com propriedades de objeto continuam unknown',()=>{
  for(const status of ['__proto__','constructor','toString'])assert.equal(normalize(status),'unknown');
});
test('replay de evento com horário equivalente não duplica nem altera estado',async()=>{
  const event={event_id:'e',status:'IN_TRANSIT',occurred_at:'2026-10-01T12:00:00Z'};
  const aggregator=new FakeAggregator({A:[event]});const service=createService({aggregator});await service.register({tracking_code:'A'});await service.sync('A');
  aggregator.data.A=[{...event,occurred_at:'2026-10-01T09:00:00-03:00'}];
  assert.equal((await service.sync('A')).events.length,1);
});
