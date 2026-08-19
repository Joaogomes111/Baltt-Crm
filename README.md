# Baltt CRM Comercial

CRM simples em React + Vite para organizar os leads do Grupo Baltt.

## O Que Tem

- Login temporario para acesso inicial.
- Um funil por empresa: Baltt, Vale e Baltec.
- Cards de leads com arrastar e soltar entre etapas.
- Cadastro, edicao, importacao CSV e exportacao CSV de leads.
- Investimentos editaveis de Meta Ads e Google Ads com calculos automaticos.
- Relatorios por etapa, origem, perdas e empresa.
- Links de WhatsApp por lead e por numero da empresa.

## Acesso Temporario

- Usuario: `Baltt@`
- Senha: `Baltt26@`

Esse login e apenas uma trava de prototipo no navegador. Quando a Supabase entrar, o ideal e trocar por autenticacao real e banco compartilhado.

## Rodar Localmente

```bash
npm install
npm run dev
```

## Validar Antes De Subir

```bash
npm run lint
npm test
```

## Subir Na Vercel

1. Subir este projeto em um repositorio do GitHub.
2. Importar o repositorio na Vercel.
3. Manter o build command como `npm run build`.
4. Manter o output directory como `dist`.

Para o passo a passo de GitHub, veja `COMO_SUBIR_GITHUB.md`.

## Supabase Depois

O arquivo `supabase/schema.sql` ja guarda uma base inicial para a proxima etapa. Quando for conectar, preencher:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
