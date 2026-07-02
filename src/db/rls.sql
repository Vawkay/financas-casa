-- Row Level Security para o app "Finanças da Casa".
-- Rode este script no SQL Editor do Supabase APÓS aplicar as migrations do Drizzle
-- (npm run db:push). Garante que cada usuário só enxerga as próprias linhas.

do $$
declare
  t text;
  tables text[] := array[
    'account', 'category', 'transaction', 'recurring_bill',
    'monthly_bill_status', 'debt', 'income_source',
    'import_batch', 'categorization_rule'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id);',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id);',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_update', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id);',
      t || '_delete', t
    );
  end loop;
end $$;
