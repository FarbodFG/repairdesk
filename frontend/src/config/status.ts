import type { RepairStatus, Role } from '../types/api'

export const roles: Record<Role, string> = { 1: 'مدیر تعمیرگاه', 2: 'پذیرش', 3: 'تعمیرکار' }
export const statuses: Record<
  RepairStatus,
  { label: string; tone: string; description: string; key: string }
> = {
  1: {
    label: 'پذیرش اولیه',
    tone: 'neutral',
    key: 'initial',
    description: 'سفارش ثبت شده و در انتظار بررسی است.',
  },
  2: {
    label: 'در حال بررسی',
    tone: 'blue',
    key: 'inspecting',
    description: 'دستگاه در مرحله بررسی و عیب‌یابی است.',
  },
  3: {
    label: 'منتظر قطعه',
    tone: 'amber',
    key: 'waiting_for_parts',
    description: 'ادامه کار در انتظار تأمین قطعه است.',
  },
  4: {
    label: 'در حال تعمیر',
    tone: 'teal',
    key: 'repairing',
    description: 'تعمیر دستگاه در حال انجام است.',
  },
  5: {
    label: 'آماده تحویل',
    tone: 'green',
    key: 'ready_for_delivery',
    description: 'دستگاه آماده تحویل است؛ برای مراجعه با تعمیرگاه هماهنگ کنید.',
  },
  6: {
    label: 'تحویل داده‌شده',
    tone: 'forest',
    key: 'delivered',
    description: 'تحویل دستگاه در سیستم ثبت شده است.',
  },
  7: {
    label: 'لغوشده',
    tone: 'red',
    key: 'cancelled',
    description: 'این سفارش لغو شده است. برای جزئیات با تعمیرگاه تماس بگیرید.',
  },
}
export const transitions: Record<RepairStatus, readonly RepairStatus[]> = {
  1: [2, 7],
  2: [3, 4, 7],
  3: [4, 7],
  4: [3, 5, 7],
  5: [6, 7],
  6: [],
  7: [],
}
export const statusIds: RepairStatus[] = [1, 2, 3, 4, 5, 6, 7]
export const canTransition = (from: RepairStatus, to: RepairStatus) =>
  transitions[from].includes(to)
export const canManage = (role: Role | null | undefined) => role === 1 || role === 2
