import {fail,required} from './http.js';
const STATES={POSTED:'posted',SHIPPED:'posted',IN_TRANSIT:'in_transit',ON_ROUTE:'out_for_delivery',OUT_FOR_DELIVERY:'out_for_delivery',DELIVERED:'delivered',EXCEPTION:'exception',DELAYED:'exception'};
export function normalize(raw){return STATES[String(raw).toUpperCase()]||'unknown';}
// Contrato independente do agregador: register(code), events(code) -> array de {event_id,status,occurred_at}
export class FakeAggregator {constructor(events={}){this.data=events;this.registered=[];}async register(code){this.registered.push(code);}async events(code){return this.data[code]||[];}}
export function createService({aggregator=new FakeAggregator(),now=()=>new Date(),delayHours=72}={}){
 const shipments=new Map();
 function find(code){const s=shipments.get(code);if(!s) fail('Rastreio não cadastrado',404);return s;}
 function output(s){const rank={unknown:0,posted:1,in_transit:2,out_for_delivery:3,exception:4,delivered:5};const sorted=[...s.events].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||rank[a.normalized_status]-rank[b.normalized_status]||a.event_id.localeCompare(b.event_id));
   let latest=null;for(const e of sorted)if(e.normalized_status!=='unknown'&&latest?.normalized_status!=='delivered') latest=e;
   const status=latest?.normalized_status||'unknown';const start=sorted.find(e=>e.normalized_status==='posted'||e.normalized_status==='in_transit');
   const delayed=!!start&&status!=='delivered'&&status!=='exception'&&now().getTime()-Date.parse(start.occurred_at)>delayHours*3600000;
   return {tracking_code:s.code,status,delayed,alert:delayed?{code:'TRANSIT_DELAY',message:`Envio ${s.code} acima do limite de ${delayHours} horas em trânsito`}:null,delay_hours:delayHours,events:sorted.map(x=>({...x})),updated_at:latest?.occurred_at||null};}
 return {
 async register({tracking_code}){required(typeof tracking_code==='string'&&!!tracking_code.trim(),'Código obrigatório');if(!shipments.has(tracking_code)){await aggregator.register(tracking_code);shipments.set(tracking_code,{code:tracking_code,events:[],ids:new Set()});}return output(find(tracking_code));},
 async sync(code){const s=find(code);const raw=await aggregator.events(code);required(Array.isArray(raw),'Eventos inválidos');for(const e of raw){required(typeof e.event_id==='string'&&!!e.event_id&&typeof e.status==='string'&&!!e.status&&Number.isFinite(Date.parse(e.occurred_at)),'Evento inválido');const found=s.events.find(x=>x.event_id===e.event_id);if(found){if(found.raw_status!==e.status||found.occurred_at!==e.occurred_at) fail('Evento duplicado divergente',409);continue;}
   s.events.push({event_id:e.event_id,raw_status:e.status,normalized_status:normalize(e.status),occurred_at:e.occurred_at});s.ids.add(e.event_id);
 }return output(s);},
 get(code){return output(find(code));}
 };
}
