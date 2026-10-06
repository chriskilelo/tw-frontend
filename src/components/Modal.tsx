import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  /** Wider panels for data-heavy dialogs; they scroll inside the viewport. Defaults to md. */
  size?: 'md' | 'xl' | '3xl'
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  xl: 'max-h-[90vh] max-w-xl overflow-y-auto',
  '3xl': 'max-h-[90vh] max-w-3xl overflow-y-auto',
}

export function Modal({ open, onClose, title, children, className = '', size = 'md' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-surface-dark/60" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className={`w-full rounded-lg bg-white p-6 shadow-xl ${SIZE_CLASSES[size]} ${className}`}>
          {title && <DialogTitle className="mb-4 text-h3 text-primary">{title}</DialogTitle>}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
