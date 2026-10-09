# Desafio 7 — Rastreio de envio ao criador

API Node.js 22 com interface `aggregator.register(code)` e `aggregator.events(code)`, implementada por `FakeAggregator`. Map de status normalizado: `posted`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `unknown`. Eventos brutos são retidos e normalizados em um adaptador central.

Eventos `event_id` são idempotentes. A projeção do status é baseada em `occurred_at` e não na ordem de chegada: evento atrasado/antigo não regride; desconhecido fica no histórico mas não vira entrega. A API inclui `alert: {code: "TRANSIT_DELAY", message: ...}` quando há atraso. Atraso se passou **mais de** `delayHours` desde a primeira postagem/trânsito e ainda não foi entregue (nem está em exceção). Relógio injetável.

```bash
npm test && npm run typecheck
npm start
curl -X POST http://localhost:3007/shipments -H 'content-type: application/json' -d '{"tracking_code":"TRACK123"}'
curl -X POST http://localhost:3007/shipments/TRACK123/sync
# response: {"tracking_code":"TRACK123","status":"in_transit","delayed":true,"delay_hours":72,"events":[{"event_id":"ev1","raw_status":"SHIPPED","normalized_status":"posted","occurred_at":"..."},...],...}
curl http://localhost:3007/shipments/TRACK123
```

Em produção: armazenamento durável, autenticação, tratamento de status reversíveis ou múltiplas entregas, notificação real e validação de payloads da transportadora. Prova de conceito sem chamadas de rede reais.

O relógio de atraso começa no primeiro evento `posted` ou `in_transit`, em ordem cronológica. O limite exato não gera alerta; +1 ms gera. `delivered` é terminal para o status do protótipo, mesmo se um evento antigo chegar depois.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Desacoplar o agregador fake; normalizar estados conhecidos e preservar unknown no histórico. |
| Geração e revisão dos testes | Cobrir eventos duplicados/fora de ordem, timestamps empatados, registro repetido, entrega terminal e atraso no limite exato e +1 ms. |
| Qualidade estrutural | Conferir ordenação temporal, ausência de regressão após entrega e relógio de atraso a partir da postagem ou trânsito. |

