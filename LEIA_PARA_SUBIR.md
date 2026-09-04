# Atualizacao CRM - filtros e relatorios

Subir estes arquivos substituindo os mesmos caminhos no projeto do CRM:

- `app/page.tsx`
- `app/globals.css`

O que muda:

- O filtro **Origem** agora permite selecionar mais de uma origem ao mesmo tempo.
- A tela **Relatorios** agora respeita os filtros de origem, entrada/data e ordenacao.
- A visao por empresa nos relatorios tambem passa a mostrar os leads filtrados.

Validado com:

- `npm run build`
- `npm test`
- `npm run lint`
