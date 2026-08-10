-- Adiciona coluna para permitir parcelamento "manual" no cadastro de produtos
-- do portfólio (/portfolio): usuário define quantidade de parcelas e valor de
-- cada parcela de forma independente, sem que um seja calculado a partir do
-- outro (o total parcelado pode não bater exatamente com `valor` à vista).
--
-- Quando null, o valor da parcela continua sendo `valor / parcelas` (modos
-- "Por quantidade" e "Por valor da parcela" no formulário).
--
-- Requer que o oliveira-joias-backend (repositório separado) passe a
-- aceitar/retornar este campo em POST/PUT /api/produtos e GET /api/produtos.

alter table public.catalogo_produtos
  add column if not exists valor_parcela numeric(10, 2);
