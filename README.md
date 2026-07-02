# Finanças da Casa

Web app pessoal de controle financeiro — substitui a planilha de contas da casa, com
importação de extrato (Mercado Pago), categorização automática, controle de dívidas e
previsão do mês. Single-user, custo de hospedagem ~R$0.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth + Storage) · Drizzle ORM · Vercel.

---

## Setup

### 1. Criar o projeto Supabase
1. Em [supabase.com](https://supabase.com), crie um projeto (plano Free) na região mais próxima (ex: South America / São Paulo).
2. Anote a senha do banco definida na criação.

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha `.env.local` com:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Project Settings → API Keys** (use a *Publishable key* `sb_publishable_...`; a Secret key não é usada).
- `DATABASE_URL` → **Project Settings → Database → Connection string → Transaction pooler** (porta `6543`).
- `ALLOWED_EMAILS` → seu e-mail (quem pode logar).
- `ANTHROPIC_API_KEY` → opcional por ora (usado na categorização por IA na Fase 2).

### 3. Aplicar o schema e a segurança (RLS)
```bash
npm install
npm run db:push        # cria as tabelas no Supabase a partir de src/db/schema.ts
```
Depois, abra o **SQL Editor** do Supabase e rode o conteúdo de [`src/db/rls.sql`](src/db/rls.sql)
(ativa Row Level Security — cada usuário só vê os próprios dados).

### 4. Rodar localmente
```bash
npm run dev
```
Acesse http://localhost:3000 → você será redirecionado para `/login`. Informe um e-mail da
allowlist e clique no link de acesso enviado por e-mail (magic link).

> Dica: em **Authentication → URL Configuration** no Supabase, adicione
> `http://localhost:3000/**` e a URL de produção da Vercel em *Redirect URLs*.

---

## Deploy na Vercel
1. Suba o repositório no GitHub e importe na [Vercel](https://vercel.com).
2. Configure as mesmas variáveis de ambiente do `.env.local` no projeto da Vercel.
3. Em *Redirect URLs* do Supabase, inclua `https://SEU-APP.vercel.app/**`.

---

## Scripts
| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:generate` | Gera migration SQL a partir do schema |
| `npm run db:push` | Aplica o schema no Supabase |
| `npm run db:studio` | Drizzle Studio (inspeção do banco) |
| `npm run db:seed` | Popula contas/categorias iniciais (Fase 1) |

---

## Roadmap (fases)
- **Fase 0 — Infra** ✅ Scaffold, schema, auth, layout. *(atual)*
- **Fase 1 — Modelo + dashboard:** contas, categorias, lançamento manual, dashboard do mês.
- **Fase 2 — Importação + categorização:** upload do extrato MP, regras + IA, revisão.
- **Fase 3 — Dívidas & cartões:** Pago/Total/Falta, faturas, pagamento como transferência.
- **Fase 4 — Previsão & receitas PJ:** projeção do mês, horas PJ, assinaturas.
- **Fase 5 — Migração da planilha** (posterior).
