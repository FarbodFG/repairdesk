import { describe, expect, it } from 'vitest'
import { canTransition, transitions } from '../../config/status'
import { parseAmount, receiptISO, normalizeTracking } from '../../lib/format'
import { defaultOrder, orderPayload, orderSchema } from './orderSchema'
describe('repair workflow contract', () => {
  it('supports the waiting-parts repair loop and rejects final-state transitions', () => {
    expect(canTransition(4, 3)).toBe(true)
    expect(canTransition(3, 4)).toBe(true)
    expect(canTransition(1, 6)).toBe(false)
    expect(canTransition(2, 2)).toBe(false)
    expect(transitions[6]).toEqual([])
    expect(transitions[7]).toEqual([])
  })
  it('creates only existing references when that mode is selected', () => {
    const values = { ...defaultOrder, customer_id: '1', device_id: '2' }
    expect(orderSchema.safeParse(values).success).toBe(true)
    expect(orderPayload(values)).toEqual({
      customer_id: 1,
      device_id: 2,
      assigned_technician_id: null,
      issue_description: '',
      final_amount: null,
      is_paid: false,
    })
  })
  it('normalizes new customer phones and excludes conflicting references', () => {
    const values = {
      ...defaultOrder,
      customerMode: 'new' as const,
      customer_id: '9',
      device_id: '9',
      new_customer: {
        name: 'مشتری آزمایشی',
        phone_number: '۰۹۱۲۰۰۰۰۰۰۰',
        available_phone_number: '',
      },
      new_device: { device_model: '', custom_model_name: 'Test device' },
    }
    expect(orderSchema.safeParse(values).success).toBe(true)
    const body = orderPayload(values)
    expect(body).not.toHaveProperty('customer_id')
    expect(body).not.toHaveProperty('device_id')
    expect(body.new_customer?.phone_number).toBe('09120000000')
    expect(body.new_device).toEqual({ custom_model_name: 'Test device' })
  })
  it('rejects payment without an amount and incompatible model inputs', () => {
    const result = orderSchema.safeParse({
      ...defaultOrder,
      customerMode: 'new',
      is_paid: true,
      new_device: { device_model: '1', custom_model_name: 'duplicate' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'amount')).toBe(true)
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'new_device.device_model'),
      ).toBe(true)
    }
  })
  it('handles grouped Persian money and rejects unsafe or decimal amounts', () => {
    expect(parseAmount('۱٬۲۰۰٬۰۰۰')).toBe(1200000)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(() => parseAmount('1.5')).toThrow()
    expect(() => parseAmount('-20')).toThrow()
    expect(() => parseAmount('9007199254740992')).toThrow()
  })
  it('produces ISO receipt times without accepting future dates', () => {
    expect(receiptISO('2020-01-01T12:30')).toMatch(/^2020-01-01T.*Z$/)
    expect(() => receiptISO('2999-01-01T12:00')).toThrow()
    expect(() => receiptISO('invalid')).toThrow()
  })
  it('normalizes tracking without requiring only the newest code format', () =>
    expect(normalizeTracking('  rdabc2345678  ')).toBe('RDABC2345678'))
})
