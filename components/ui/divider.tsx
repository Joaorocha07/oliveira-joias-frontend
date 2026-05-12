import { cn } from '@/lib/cn'

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-gold-100 my-4', className)} />
}
