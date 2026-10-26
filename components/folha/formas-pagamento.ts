import type { FormaPagamento } from '@/types'
import { FORMA_PAGAMENTO_LABEL } from '@/utils'

// Formas aceitas para pagar salário/vale (sem crediário/misto).
const FORMAS: FormaPagamento[] = ['pix', 'dinheiro', 'transferencia', 'cartao_debito', 'cheque']

export const FORMAS_PAGAMENTO_FOLHA = FORMAS.map((value) => ({ value, label: FORMA_PAGAMENTO_LABEL[value] }))
