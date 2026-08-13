import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-surface-dark/60" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className={`w-full max-w-md rounded-lg bg-white p-6 shadow-xl ${className}`}>
          {title && <DialogTitle className="mb-4 text-h3 text-primary">{title}</DialogTitle>}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
