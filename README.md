# Desafio 7 — Rastreio de envio ao criador

API Node.js 22 com interface `aggregator.register(code)` e `aggregator.events(code)`, implementada por `FakeAggregator` e pelo cliente HTTP `HttpAggregator`. Map de status normalizado: `posted`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `unknown`. Eventos brutos são retidos e normalizados em um adaptador central.

Eventos `event_id` são idempotentes. A projeção do status é baseada em `occurred_at` e não na ordem de chegada: evento atrasado/antigo não regride; desconhecido fica no histórico mas não vira entrega. A API inclui `alert: {code: "TRANSIT_DELAY", message: ...}` quando há atraso. Atraso se passou **mais de** `delayHours` desde a primeira postagem/trânsito e ainda não foi entregue (nem está em exceção). Relógio injetável.

```bash
npm test && npm run typecheck
npm start
curl -X POST http://localhost:3007/shipments -H 'content-type: application/json' -d '{"tracking_code":"TRACK123"}'
curl -X POST http://localhost:3007/shipments/TRACK123/sync
# response: {"tracking_code":"TRACK123","status":"in_transit","delayed":true,"delay_hours":72,"events":[{"event_id":"ev1","raw_status":"SHIPPED","normalized_status":"posted","occurred_at":"..."},...],...}
curl http://localhost:3007/shipments/TRACK123
```

Em produção: armazenamento durável, autenticação, tratamento de status reversíveis ou múltiplas entregas, notificação real e validação de payloads da transportadora. O modo padrão usa dados simulados; o adaptador HTTP pode consultar um agregador fictício com o contrato abaixo.

O relógio de atraso começa no primeiro evento `posted` ou `in_transit`, em ordem cronológica. O limite exato não gera alerta; +1 ms gera. `delivered` é terminal para o status do protótipo, mesmo se um evento antigo chegar depois.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Desacoplar o agregador fake; normalizar estados conhecidos e preservar unknown no histórico. |
| Geração e revisão dos testes | Cobrir eventos duplicados/fora de ordem, timestamps empatados, registro repetido, entrega terminal e atraso no limite exato e +1 ms. |
| Qualidade estrutural | Conferir ordenação temporal, ausência de regressão após entrega e relógio de atraso a partir da postagem ou trânsito. |


## Cliente HTTP do agregador

`src/aggregator.js` concentra o transporte HTTP e implementa a mesma interface `register(code)` / `events(code)` do fake. O serviço de rastreio não conhece URLs, headers ou respostas HTTP. O cliente usa `fetch`, timeout configurável (3000 ms por padrão), URL encoding do código e validação de resposta antes de entregar eventos à regra de negócio.

Contrato do agregador fictício:

- `POST /tracking`, JSON `{"tracking_code":"TRACK123"}`: HTTP 201 ou 204.
- `GET /tracking/TRACK123/events`: HTTP 200 com o payload bruto abaixo.

```json
{
  "events": [
    {"event_id":"ev1","status":"SHIPPED","occurred_at":"2026-10-01T12:00:00Z"},
    {"event_id":"ev2","status":"IN_TRANSIT","occurred_at":"2026-10-02T12:00:00Z"}
  ]
}
```

A API normaliza o segundo evento como `{"event_id":"ev2","raw_status":"IN_TRANSIT","normalized_status":"in_transit","occurred_at":"2026-10-02T12:00:00Z"}`. Configure `AGGREGATOR_BASE_URL` para selecionar o cliente HTTP ao iniciar a API. Exemplo PowerShell, supondo um agregador local que implemente esse contrato:

```powershell
$env:AGGREGATOR_BASE_URL='http://127.0.0.1:4017'
npm start
```

Também é possível injetar `new HttpAggregator({baseUrl, timeoutMs, fetchImpl})` em `createService`. Falhas HTTP/rede e JSON ou eventos inválidos produzem 502; timeout produz 504. Não há retry automático neste adaptador. O teste usa um servidor HTTP fictício local e não depende de um provedor externo.

Validação: 9 testes aprovados, incluindo transporte HTTP real local, cadastro sem corpo (204), código com caracteres especiais, duplicatas e eventos fora de ordem, status desconhecido, falha 503 sem cadastro parcial, JSON/eventos inválidos sem alteração de histórico e timeout. `npm run typecheck` verifica sintaxe JavaScript, incluindo o novo adaptador.

Este complemento foi implementado e validado automaticamente pelo Codex após a revisão pessoal anteriormente declarada pelo autor. Cabe ao autor conferir o contrato HTTP e os novos testes antes da submissão.
