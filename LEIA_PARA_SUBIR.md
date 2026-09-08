# Atualizacao CRM - design dashboard moderno

Subir estes arquivos substituindo os mesmos caminhos no projeto do CRM:

- `app/page.tsx`
- `app/globals.css`

O que muda:

- CRM inteiro redesenhado para um visual dark premium inspirado no dashboard de referencia.
- Sidebar, topo, cards de metricas, funis, lista de leads, investimentos, relatorios e modal de lead seguem o novo estilo.
- Cards principais agora usam pictogramas especificos para leads no funil, propostas, vendas fechadas e custo por lead.
- Grafico de evolucao de receita ganhou tooltip proprio animado, com mes e valor em destaque no mesmo visual do CRM.
- Sidebar ganhou botao para recolher/expandir.
- Mantidas as correcoes recentes de filtros, relatorios e origem `Nao informado`.
- Nenhuma dependencia nova foi adicionada.

Validado com:

- `npm run build`
- `npm test`
- `npm run lint`

Testado localmente em:

- `http://127.0.0.1:5174/`
