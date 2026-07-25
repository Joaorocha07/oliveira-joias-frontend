-- Adiciona campo para registrar quando o cliente iniciou a conversa com o vendedor
-- Usado para calcular tempo médio de fechamento no CRM
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_inicio_conversa date;
