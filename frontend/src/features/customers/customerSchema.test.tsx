import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CustomerFields } from './CustomerFields'
import { customerSchema, smsPhoneNumber } from './customerSchema'

it('accepts a blank, equal or different reachable phone and selects exactly one destination', () => {
  for (const secondary of ['', '09120000001', '09121112233']) {
    const parsed = customerSchema.parse({
      name: 'مشتری تست', phone_number: '09120000001', available_phone_number: secondary,
    })
    expect(smsPhoneNumber(parsed)).toBe(secondary || '09120000001')
  }
})

it('normalizes Persian digits in the reachable number before submission', () => {
  const parsed = customerSchema.parse({
    name: 'مشتری تست', phone_number: '09120000001', available_phone_number: '۰۹۱۲۱۱۱۲۲۳۳',
  })
  expect(smsPhoneNumber(parsed)).toBe('09121112233')
})

it('explains which number receives messages and the blank-number fallback accessibly', () => {
  render(<CustomerFields values={{ name: '', phone_number: '', available_phone_number: '' }} onChange={vi.fn()} />)
  expect(screen.getByRole('textbox', { name: 'شماره موبایل اصلی مشتری' })).toBeVisible()
  const reachable = screen.getByRole('textbox', { name: 'شماره در دسترس برای پیامک (اختیاری)' })
  expect(reachable).toHaveAccessibleDescription(/اگر خالی باشد، شمارهٔ اصلی استفاده می‌شود/)
})
