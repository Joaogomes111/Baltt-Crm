# Configurar usuarios por empresa

## 1. Criar usuarios no Supabase

Em `Authentication > Users`, crie estes usuarios:

```txt
admin@baltt.com.br    admin geral
crm@baltt.com.br      admin geral (opcional)
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
admin@baltt.com.br    ve todos os funis
baltt@baltt.com.br    ve Baltt e cadeado nos outros
vale@baltt.com.br     ve Vale e cadeado nos outros
baltec@baltt.com.br   ve Baltec e cadeado nos outros
```

## 5. Se os leads pararem de salvar na Supabase

Sintoma: o CRM mostra "Base Supabase ativa" mas, em uma janela anonima ou em
outro computador, os leads novos nao aparecem (ficaram so no navegador).

Causa (corrigida em 2026-09-14): o app chamava funcoes `..._v2` que nao existiam
no banco e, na falha, lia a tabela direto; a Supabase devolvia vazio por causa
do RLS e o app tratava como sucesso. Alem disso, cada salvamento enviava a base
inteira do navegador, apagando leads que tinham chegado pelos webhooks da Meta
e do site nesse meio-tempo.

Correcao:

1. Rode `supabase/crm_functions.sql` no SQL Editor (idempotente).
2. Faca o deploy da versao atual (Vercel).
3. Confira: o usuario precisa existir em `Authentication > Users` **e** em
   `crm_user_permissions` (o SQL acima ja cadastra os e-mails padrao).

O salvamento agora faz merge por id no banco: leads recebidos por webhook sao
preservados e apenas os leads que o usuario excluiu sao removidos. O CRM
tambem recarrega a base ao voltar para a aba e a cada 60 segundos.
