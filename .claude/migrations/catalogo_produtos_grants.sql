-- Fix: tabela catalogo_produtos foi criada sem GRANT para service_role,
-- causando "permission denied for table catalogo_produtos" em toda chamada
-- do oliveira-joias-backend (que usa exclusivamente a service_role key).
-- anon/authenticated já tinham SELECT correto (restrito por policy a ativo = true).

grant select, insert, update, delete on public.catalogo_produtos to service_role;
