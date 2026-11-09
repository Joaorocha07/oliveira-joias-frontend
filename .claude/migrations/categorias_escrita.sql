-- Permite que admin e caixa criem e renomeiem categorias de lançamento (tela /caixa).
-- Só é necessária se o modal mostrar "Sem permissão para alterar categorias."
-- Não libera exclusão e não altera a leitura. Pode rodar mais de uma vez.

grant insert, update on public.categorias to authenticated;

drop policy if exists categorias_insert_financeiro on public.categorias;
create policy categorias_insert_financeiro on public.categorias
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'caixa'))
  );

drop policy if exists categorias_update_financeiro on public.categorias;
create policy categorias_update_financeiro on public.categorias
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'caixa'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'caixa'))
  );
