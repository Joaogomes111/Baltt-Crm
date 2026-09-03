# Integracao Site WordPress -> Baltt CRM

Este endpoint recebe formularios do site WordPress e grava o lead no mesmo funil do CRM.

## Arquivo criado

```text
api/webhooks/site-leads.ts
```

## Variavel obrigatoria na Vercel

Adicione em `Settings` > `Environment Variables`:

```text
SITE_LEADS_WEBHOOK_TOKEN=crie-uma-senha-grande-aqui
```

Use o ambiente `Production` e faca um novo deploy depois de salvar.

## URL do webhook

Baltt:

```text
https://baltt-crm.vercel.app/api/webhooks/site-leads?company=baltt
```

Vale:

```text
https://baltt-crm.vercel.app/api/webhooks/site-leads?company=vale
```

Baltec:

```text
https://baltt-crm.vercel.app/api/webhooks/site-leads?company=baltec
```

## Cabecalho do webhook

Configure no Bit Form:

```text
x-site-leads-token: MESMO_VALOR_DO_SITE_LEADS_WEBHOOK_TOKEN
```

## Corpo enviado pelo formulario

O ideal e mandar JSON ou form-urlencoded com estes nomes:

```json
{
  "name": "campo Nome",
  "phone": "campo WhatsApp",
  "city": "campo Cidade",
  "source": "Site",
  "form_name": "Orcamento - Baltt"
}
```

O endpoint tambem aceita as chaves atuais vistas no Bit Form:

```text
bl-2 = Nome
bl-4 = WhatsApp
bl-5 = Cidade
```

## Redirecionamento para WhatsApp

Depois de enviar o formulario, configure a confirmacao/redirecionamento do Bit Form para o WhatsApp da empresa.

Baltt:

```text
https://wa.me/5547991695770?text=Ola%2C%20vim%20pelo%20site%20da%20Baltt%20e%20quero%20um%20orcamento.
```

Vale:

```text
https://wa.me/5547991233416?text=Ola%2C%20vim%20pelo%20site%20da%20Vale%20e%20quero%20um%20orcamento.
```

Baltec:

```text
https://wa.me/554799505553?text=Ola%2C%20vim%20pelo%20site%20da%20Baltec%20e%20quero%20um%20orcamento.
```

## Resultado no CRM

O lead entra em:

```text
Etapa: Novo WhatsApp
Origem: Site
Status: Novo
```
