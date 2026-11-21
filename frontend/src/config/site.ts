export const site = {
  productName: 'RepairDesk',
  name: 'میز تعمیر',
  shopName: import.meta.env.VITE_SHOP_NAME || 'شهر آفتاب',
  phone: import.meta.env.VITE_SHOP_PHONE || '09191861006',
  address: (import.meta.env.VITE_SHOP_ADDRESS || null) as string | null,
  hours: import.meta.env.VITE_SHOP_HOURS || 'شنبه تا پنجشنبه، ۱۰:۰۰ تا ۱۳:۰۰ و ۱۷:۰۰ تا ۲۱:۰۰',
  currency: import.meta.env.VITE_CURRENCY_LABEL || 'واحد پول تنظیم نشده',
  timezone: 'Asia/Tehran',
  services: [
    {
      title: 'تعمیر انواع موبایل',
      description: 'پذیرش و بررسی مشکل انواع گوشی موبایل و پیگیری مراحل تعمیر با کد سفارش.',
      icon: 'phone',
    },
    {
      title: 'نمایشگر و لمس',
      description: 'بررسی مشکلات تصویر، شکستگی نمایشگر و عملکرد لمس.',
      icon: 'screen',
    },
    {
      title: 'باتری و شارژ',
      description: 'بررسی باتری، درگاه شارژ و مشکلات تأمین انرژی.',
      icon: 'battery',
    },
    {
      title: 'لوازم جانبی موبایل',
      description: 'فروش لوازم جانبی موبایل؛ برای اطلاع از موجودی و قیمت با فروشگاه تماس بگیرید.',
      icon: 'accessories',
    },
  ],
  servicesNotice: 'برای هماهنگی پذیرش دستگاه یا پرسش دربارهٔ موجودی لوازم جانبی، در ساعت کاری با ما تماس بگیرید.',
} as const
