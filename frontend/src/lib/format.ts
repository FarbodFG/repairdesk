import { site } from '../config/site'
import type { Device } from '../types/api'

export const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value)
export const money = (value: number | null) =>
  value === null ? 'هنوز تعیین نشده' : `${number(value)} ${site.currency}`
export function dateTime(value: string | null) {
  if (!value) return 'ثبت نشده'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'تاریخ نامعتبر'
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: site.timezone,
  }).format(date)
}
export const deviceName = (device: Device) =>
  device.device_model
    ? `${device.device_model.brand.name} ${device.device_model.name}`
    : device.custom_model_name
export const latinDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (char) =>
    String(char.charCodeAt(0) >= 1776 ? char.charCodeAt(0) - 1776 : char.charCodeAt(0) - 1632),
  )
export const normalizeTracking = (value: string) => latinDigits(value.trim()).toUpperCase()
export function parseAmount(value: string): number | null {
  if (!value.trim()) return null
  const normalized = latinDigits(value).replace(/[,٬\s]/g, '')
  if (!/^\d+$/.test(normalized)) throw new Error('مبلغ باید عدد صحیح و نامنفی باشد.')
  const amount = Number(normalized)
  if (!Number.isSafeInteger(amount)) throw new Error('مبلغ از محدوده مجاز بزرگ‌تر است.')
  return amount
}
export function localDateTimeMax() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
export function receiptISO(value: string) {
  const parsed = new Date(value)
  if (!value || Number.isNaN(parsed.getTime())) throw new Error('تاریخ و ساعت معتبر وارد کنید.')
  if (parsed.getTime() > Date.now()) throw new Error('زمان دریافت دستگاه نمی‌تواند در آینده باشد.')
  return parsed.toISOString()
}
