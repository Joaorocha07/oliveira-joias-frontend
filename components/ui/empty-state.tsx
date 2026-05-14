import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  imageSrc?: string
  imageAlt?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, imageSrc, imageAlt = '', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full max-w-[200px] sm:max-w-[240px] h-auto object-contain mb-5 select-none pointer-events-none"
          draggable={false}
        />
      ) : icon ? (
        <div className="text-gold-200 mb-5 [&>svg]:w-12 [&>svg]:h-12">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium text-dark-400">{title}</h3>
      {description && (
        <p className="text-sm text-dark-300 mt-1.5 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
