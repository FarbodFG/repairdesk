import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
export function SearchInput({
  value,
  onChange,
  placeholder = 'جست‌وجو…',
  label = 'جست‌وجو',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setDraft(value)
    if (timer.current) clearTimeout(timer.current)
  }, [value])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return (
    <div className="search-input">
      <Search size={18} />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(text.trim()), 350)
        }}
      />
    </div>
  )
}
