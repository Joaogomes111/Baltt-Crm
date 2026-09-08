# Atualizacao CRM - design dashboard moderno

Subir estes arquivos substituindo os mesmos caminhos no projeto do CRM:

- `app/page.tsx`
- `app/globals.css`

O que muda:

- CRM inteiro redesenhado para um visual dark premium inspirado no dashboard de referencia.
- Sidebar, topo, cards de metricas, funis, lista de leads, investimentos, relatorios e modal de lead seguem o novo estilo.
- Sidebar ganhou botao para recolher/expandir.
- Mantidas as correcoes recentes de filtros, relatorios e origem `Nao informado`.
- Nenhuma dependencia nova foi adicionada.

Validado com:

- `npm run build`
- `npm test`
- `npm run lint`

Testado localmente em:

- `http://127.0.0.1:5174/`
