# Como Subir No GitHub

## Pelo Site Do GitHub

1. Criar um repositorio novo no GitHub.
2. Fazer upload de todos os arquivos desta pasta.
3. Confirmar o commit no GitHub.
4. Importar esse repositorio na Vercel.

## Pelo Terminal

Depois de criar o repositorio no GitHub, rode estes comandos dentro desta pasta:

```bash
git remote add origin URL_DO_REPOSITORIO
git branch -M main
git push -u origin main
```

Na Vercel, use:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

## Acesso Temporario

- Usuario: `Baltt@`
- Senha: `Baltt26@`

Na proxima etapa, esse acesso deve virar login real pela Supabase.

## Conectar Supabase

1. Na Supabase, crie um projeto novo.
2. Abra `SQL Editor` > `New query`.
3. Cole o conteudo de `supabase/schema.sql` e clique em `Run`.
4. Abra `Authentication` > `Users` > `Add user`.
5. Crie o usuario:

```text
Email: baltt@baltt.com.br
Password: Baltt26@
Auto Confirm User: ligado
```

6. Abra `Project Settings` > `API` e copie:

```text
Project URL
anon public key
```

7. Na Vercel, abra o projeto > `Settings` > `Environment Variables` e adicione:

```bash
VITE_SUPABASE_URL=Project URL
VITE_SUPABASE_ANON_KEY=anon public key
VITE_SUPABASE_LOGIN_EMAIL=baltt@baltt.com.br
```

8. Faca um novo deploy na Vercel.

Depois disso, o login pode ser feito com:

```text
Usuario: Baltt@
Senha: Baltt26@
```
