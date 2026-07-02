<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Finanças da Casa — guia do projeto

App de finanças pessoais que substitui uma planilha. Plano completo e faseamento em
`../.claude/plans/fluffy-snacking-quill.md` (fora do repo).

## Stack
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** + **Tailwind v4**.
- **Supabase**: Postgres (dados) + Auth (magic link) + Storage (arquivos de extrato).
- **Drizzle ORM** (`src/db/schema.ts`) — migrations em `drizzle/`.
- UI própria em `src/components/ui` (padrão shadcn, sem o CLI). `cn`/formatadores em `src/lib/utils.ts`.

## Convenções
- Auth: convenção **`proxy`** do Next 16 (`src/proxy.ts`, não `middleware.ts`). Clients Supabase em
  `src/lib/supabase/{client,server,middleware}.ts`. Allowlist de e-mails em `src/lib/auth.ts`.
- Rotas autenticadas no route group `src/app/(app)` (envolto pelo `AppShell`); `/login` e `/auth/*` são públicas.
- **Isolamento por usuário**: toda tabela de dados tem `user_id`; RLS em `src/db/rls.sql` (rodar no Supabase após `db:push`).
- Dinheiro: colunas `numeric(14,2)` (vêm como **string** no JS — converter com cuidado). UI em BRL via `formatBRL`.
- **Modelo das 3 dores**: gasto variável entra pela importação; pagamento de fatura = `TRANSFER` (não despesa);
  empréstimos = tabela `debt` (Pago/Total/Falta). Não modelar pagamento de fatura como EXPENSE.

## Comandos
- `npm run dev` — desenvolvimento. `npm run build` — build de produção.
- `npm run db:generate` — gera migration a partir do schema. `npm run db:push` — aplica no Supabase.
- `npm run db:studio` — Drizzle Studio. `npm run db:seed` — popula contas/categorias iniciais.
