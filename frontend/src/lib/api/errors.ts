const translations: Record<string, string> = {
  'This field is required.': 'این فیلد الزامی است.',
  'This field may not be blank.': 'این فیلد نباید خالی باشد.',
  'Enter a valid email address.': 'نشانی ایمیل معتبر وارد کنید.',
  'A user with that username already exists.': 'این نام کاربری قبلاً ثبت شده است.',
  'No active account found with the given credentials':
    'نام کاربری یا رمز عبور درست نیست یا حساب غیرفعال است.',
  'This password is too common.': 'این رمز عبور بسیار رایج است.',
  'This password is entirely numeric.': 'رمز عبور نباید فقط عدد باشد.',
  'This password is too short. It must contain at least 8 characters.':
    'رمز عبور باید دست‌کم ۸ کاراکتر داشته باشد.',
  'Invalid page.': 'این صفحه وجود ندارد. فیلترها را بازنشانی کنید.',
  'Not found.': 'اطلاعات موردنظر پیدا نشد.',
  'You do not have permission to perform this action.': 'اجازه انجام این عملیات را ندارید.',
  'Authentication credentials were not provided.': 'برای ادامه وارد حساب کاربری شوید.',
  'Token is invalid or expired': 'نشست شما پایان یافته است. دوباره وارد شوید.',
  'Token is expired': 'نشست شما پایان یافته است. دوباره وارد شوید.',
}
function translate(message: string) {
  return translations[message] || message
}
export function flattenErrors(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix || 'non_field_errors']: translate(value) }
  if (Array.isArray(value))
    return value.every((v) => typeof v === 'string')
      ? { [prefix || 'non_field_errors']: value.map(translate).join(' ') }
      : Object.assign({}, ...value.map((v, i) => flattenErrors(v, `${prefix}.${i}`)))
  if (value && typeof value === 'object')
    return Object.assign(
      {},
      ...Object.entries(value)
        .filter(([key]) => !['code', 'messages'].includes(key))
        .map(([key, v]) => flattenErrors(v, prefix ? `${prefix}.${key}` : key)),
    )
  return {}
}
export class ApiError extends Error {
  readonly fields: Record<string, string>
  constructor(
    public status: number,
    data?: unknown,
  ) {
    const fields = flattenErrors(data)
    const fallback =
      status === 401
        ? 'نشست شما پایان یافته است. دوباره وارد شوید.'
        : status === 403
          ? 'اجازه انجام این عملیات را ندارید.'
          : status === 404
            ? 'اطلاعات موردنظر پیدا نشد.'
            : status >= 500
              ? 'سرور با خطا روبه‌رو شد. کمی بعد دوباره تلاش کنید.'
              : status === 0
                ? 'ارتباط با سرور برقرار نشد. اتصال و تنظیمات API را بررسی کنید.'
                : 'اطلاعات واردشده را بررسی کنید.'
    const nestedNonField = Object.entries(fields).find(([path]) =>
      path.endsWith('.non_field_errors'),
    )?.[1]
    super(
      status >= 500
        ? fallback
        : fields.detail || fields.non_field_errors || nestedNonField || fallback,
    )
    this.name = 'ApiError'
    this.fields = status >= 500 ? {} : fields
  }
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'خطای پیش‌بینی‌نشده رخ داد.'
