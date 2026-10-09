import {http} from './http.js';import {createService,FakeAggregator} from './service.js';
import {HttpAggregator} from './aggregator.js';
const agg=new FakeAggregator({TRACK123:[{event_id:'ev1',status:'SHIPPED',occurred_at:'2026-10-01T12:00:00Z'},{event_id:'ev2',status:'IN_TRANSIT',occurred_at:'2026-10-02T12:00:00Z'}]});
export function createApp(service=createService({aggregator:process.env.AGGREGATOR_BASE_URL?new HttpAggregator({baseUrl:process.env.AGGREGATOR_BASE_URL}):agg})){return http(service,[['POST',/^\/shipments$/, (s,b)=>s.register(b)],['POST',/^\/shipments\/([^/]+)\/sync$/, (s,b,id)=>s.sync(id)],['GET',/^\/shipments\/([^/]+)$/, (s,b,id)=>s.get(id)]]);}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)createApp().listen(3007,()=>console.log('http://localhost:3007'));
