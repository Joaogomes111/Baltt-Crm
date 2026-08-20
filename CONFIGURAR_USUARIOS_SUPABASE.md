# Configurar usuarios por empresa

## 1. Criar usuarios no Supabase

Em `Authentication > Users`, crie estes usuarios:

```txt
crm@baltt.com.br      admin geral
baltt@baltt.com.br    acesso Baltt
vale@baltt.com.br     acesso Vale
baltec@baltt.com.br   acesso Baltec
```

Pode usar a senha temporaria `Baltt26@` para todos e trocar depois se quiser.

## 2. Rodar o SQL

No Supabase, abra `SQL Editor` e rode o arquivo:

```txt
supabase/schema.sql
```

Esse SQL cria:

- tabela `crm_user_permissions`
- permissao admin para `crm@baltt.com.br`
- permissao por empresa para Baltt, Vale e Baltec
- funcoes seguras para carregar/salvar apenas os leads permitidos
- bloqueio direto da tabela `crm_snapshots` para usuarios que nao sejam admin

Se criar os usuarios depois de rodar o SQL, rode o mesmo SQL de novo. Ele e idempotente.

## 3. Subir na Vercel

Depois de subir os arquivos no GitHub, faca um redeploy na Vercel.

## 4. Testar

```txt
crm@baltt.com.br      ve todos os funis
baltt@baltt.com.br    ve Baltt e cadeado nos outros
vale@baltt.com.br     ve Vale e cadeado nos outros
baltec@baltt.com.br   ve Baltec e cadeado nos outros
```
