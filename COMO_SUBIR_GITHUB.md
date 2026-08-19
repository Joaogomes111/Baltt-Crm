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
