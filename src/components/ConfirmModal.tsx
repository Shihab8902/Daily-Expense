import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="rounded-xl border border-gray-200 p-0 shadow-lg backdrop:bg-black/30 w-[90%] max-w-sm"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
