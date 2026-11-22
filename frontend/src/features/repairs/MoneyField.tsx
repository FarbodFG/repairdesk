import type { ComponentPropsWithRef } from 'react'
import { Field } from '../../components/ui/Field'
import { site } from '../../config/site'
import { latinDigits, parseAmount } from '../../lib/format'

const small = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده']
const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'کوادریلیون']

function amountWords(amount: number) {
  if (!amount) return small[0]
  const parts: string[] = []
  for (let scale = 0; amount > 0; scale++, amount = Math.floor(amount / 1000)) {
    const group = amount % 1000
    if (!group) continue
    const rest = group % 100
    const words = [hundreds[Math.floor(group / 100)]]
    if (rest >= 20) words.push(tens[Math.floor(rest / 10)])
    if (rest % 10 || (rest > 0 && rest < 20)) words.push(small[rest < 20 ? rest : rest % 10])
    parts.unshift([words.filter(Boolean).join(' و '), scales[scale]].filter(Boolean).join(' '))
  }
  return parts.join(' و ')
}

function stripGroups(value: string) {
  const digits = latinDigits(value).replace(/[,٬\s]/g, '')
  return /^\d+$/.test(digits) || !value.trim() ? digits : value
}

function displayAmount(value: string) {
  return /^\d{1,16}$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value
}

function AmountInput({ value, onValueChange, ...props }: Omit<ComponentPropsWithRef<'input'>, 'value'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const display = displayAmount(stripGroups(value))
  return (
    <input
      {...props}
      className="money-input"
      value={display}
      type="text"
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      onKeyDown={(event) => {
        const input = event.currentTarget
        const start = input.selectionStart
        if (start === null || start !== input.selectionEnd) return
        // Include the adjacent digit when a delete would only remove a grouping comma.
        if (event.key === 'Backspace' && display[start - 1] === ',' && start > 1)
          input.setSelectionRange(start - 2, start)
        if (event.key === 'Delete' && display[start] === ',' && start + 1 < display.length)
          input.setSelectionRange(start, start + 2)
      }}
      onChange={(event) => {
        const input = event.currentTarget
        const entered = input.value
        const raw = stripGroups(entered)
        const formatted = displayAmount(raw)
        if (entered !== formatted) {
          const remaining = stripGroups(entered.slice(input.selectionStart ?? entered.length)).length
          let caret = formatted.length
          let digitsSeen = 0
          while (caret > 0 && digitsSeen < remaining) {
            if (formatted[--caret] !== ',') digitsSeen++
          }
          input.value = formatted
          input.setSelectionRange(caret, caret)
        }
        onValueChange(raw)
      }}
    />
  )
}

export function MoneyField({ error, ...props }: ComponentPropsWithRef<typeof AmountInput> & { error?: string }) {
  let words: string | undefined
  try {
    const amount = parseAmount(props.value)
    if (amount !== null) words = `${amountWords(amount)} ${site.currency}`
  } catch {
    // The order form supplies the validation message.
  }
  return (
    <div className="money-field">
      <Field
        label={`مبلغ نهایی (${site.currency})`}
        hint={words || 'اگر مبلغ مشخص نیست، خالی بگذارید.'}
        error={error}
      >
        <AmountInput {...props} />
      </Field>
    </div>
  )
}
