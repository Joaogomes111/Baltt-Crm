# Integracao Meta Formularios -> Baltt CRM

Este guia e para ligar campanhas de formulario do Facebook/Instagram ao CRM.

## 1. O Que Ja Fica No Codigo

Depois de subir esta atualizacao, o CRM tera esta URL de webhook:

```txt
https://baltt-crm.vercel.app/api/webhooks/meta-leads
```

A Meta usa essa URL em dois momentos:

- `GET`: validar o webhook usando o token de verificacao.
- `POST`: avisar que chegou um lead novo de formulario.

Quando chega um lead, o CRM:

1. recebe o `leadgen_id` da Meta;
2. busca os dados completos do lead na Graph API;
3. transforma em card do CRM;
4. salva no funil da empresa certa;
5. evita duplicado por `leadgen_id` e telefone/data.

## 2. Variaveis Da Vercel

No projeto da Vercel, entrar em:

```txt
Settings -> Environment Variables
```

Adicionar estas variaveis em `Production`:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
META_VERIFY_TOKEN
META_APP_SECRET
META_PAGE_ACCESS_TOKEN
META_GRAPH_API_VERSION
META_DEFAULT_COMPANY
META_DEFAULT_SERVICE
META_FORM_COMPANY_MAP
```

Valores recomendados:

```txt
META_GRAPH_API_VERSION=v25.0
META_DEFAULT_COMPANY=baltt
META_FORM_COMPANY_MAP={}
```

O `META_VERIFY_TOKEN` pode ser uma senha/frase criada por voce. Exemplo:

```txt
baltt_meta_leads_2026
```

Nao usar espaco no token.

## 3. Mapa De Formularios Por Empresa

Quando tivermos os IDs dos formularios da Meta, da para direcionar cada formulario para a empresa certa.

Exemplo:

```json
{
  "1234567890": "baltt",
  "2222222222": "vale",
  "3333333333": "baltec"
}
```

Esse JSON entra na variavel:

```txt
META_FORM_COMPANY_MAP
```

Enquanto esse mapa estiver vazio, todo lead novo entra em `baltt`.

## 4. Campos Que O CRM Tenta Ler Do Formulario

O webhook procura automaticamente estes campos:

- nome: `full_name`, `nome_completo`, `nome completo`, `name`, `nome`
- telefone: `phone_number`, `telefone`, `celular`, `whatsapp`, `mobile_phone`, `phone`
- email: `email`, `e-mail`
- cidade: `city`, `cidade`
- bairro: `neighborhood`, `bairro`
- servico/produto: `produto`, `servico`, `serviço`, `interesse`, `tipo_de_servico`

As respostas completas tambem ficam salvas em `Observacoes` do lead.

## 5. Ordem Pratica

1. Subir a pasta `api` no GitHub.
2. Subir o `.env.example` e este guia, se quiser manter documentado.
3. Esperar a Vercel criar novo deploy.
4. Criar as variaveis na Vercel.
5. Fazer outro redeploy para as variaveis entrarem.
6. Abrir a URL do webhook no navegador para conferir se responde.
7. Criar/configurar app no Meta Developers.
8. Em Webhooks, usar a URL do CRM e o `META_VERIFY_TOKEN`.
9. Assinar o campo `leadgen`.
10. Testar pelo Lead Ads Testing Tool da Meta.

## 6. Depois Do Primeiro Teste

Quando o primeiro lead teste chegar, entrar no CRM e procurar:

- empresa configurada;
- coluna `Novo WhatsApp`;
- origem `Meta Ads`;
- campanha/formulario nas informacoes do card.
