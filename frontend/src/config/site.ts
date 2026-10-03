export const site = {
  productName: 'RepairDesk',
  name: 'میز تعمیر',
  shopName: 'نام تعمیرگاه شما',
  phone: null as string | null,
  address: 'آدرس تعمیرگاه هنوز ثبت نشده است.',
  hours: 'ساعت کاری هنوز ثبت نشده است.',
  currency: import.meta.env.VITE_CURRENCY_LABEL || 'واحد پول تنظیم نشده',
  timezone: 'Asia/Tehran',
  services: [
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
      title: 'برد و سخت‌افزار',
      description: 'عیب‌یابی اجزای داخلی و مشکلات سخت‌افزاری دستگاه.',
      icon: 'cpu',
    },
    {
      title: 'نرم‌افزار و سیستم',
      description: 'بررسی اختلال‌های سیستم‌عامل و عملکرد نرم‌افزاری.',
      icon: 'software',
    },
  ],
  servicesNotice: 'دسته‌بندی‌های قابل بررسی؛ پذیرش هر خدمت به تأیید تعمیرگاه بستگی دارد.',
} as const
