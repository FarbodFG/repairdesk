import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = '',
  returnFocus,
  initialFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
  className?: string
  returnFocus?: RefObject<HTMLElement | null>
  initialFocus?: RefObject<HTMLElement | null>
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${className}`}
          dir="rtl"
          onOpenAutoFocus={initialFocus ? (event) => {
            if (initialFocus.current) {
              event.preventDefault()
              initialFocus.current.focus()
            }
          } : undefined}
          onCloseAutoFocus={returnFocus ? (event) => {
            if (returnFocus.current) {
              event.preventDefault()
              returnFocus.current.focus()
            }
          } : undefined}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="بستن">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
