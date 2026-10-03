import { Copy } from 'lucide-react'
import { useToast } from './Toast'
export function CopyButton({ value, label = 'کپی' }: { value: string; label?: string }) {
  const toast = useToast()
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast('کپی شد.')
        } catch {
          toast('کپی ممکن نشد؛ متن را انتخاب و کپی کنید.')
        }
      }}
    >
      <Copy size={15} />
    </button>
  )
}
