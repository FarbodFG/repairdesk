import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUpLeft,
  Smartphone,
  BatteryCharging,
  Cpu,
  ShoppingBag,
  ScanLine,
  ClipboardCheck,
  CircleCheck,
  Eye,
  Layers3,
  Phone,
  MapPin,
  Clock3,
  Sun,
  ChevronDown,
} from 'lucide-react'
import { HeroVisual } from './HeroVisual'
import { TrackingForm } from '../tracking/TrackingForm'
import { site } from '../../config/site'
import { useLandingMotion } from '../../lib/animations/useLandingMotion'
import '../../styles/landing.css'
const icons = [Smartphone, ScanLine, BatteryCharging, ShoppingBag]
const steps = [
  {
    icon: ClipboardCheck,
    title: 'پذیرش و ثبت دستگاه',
    text: 'مشکل دستگاه ثبت می‌شود و کد پیگیری دریافت می‌کنید.',
  },
  {
    icon: ScanLine,
    title: 'بررسی و عیب‌یابی',
    text: 'وضعیت دستگاه بررسی و مسیر تعمیر مشخص می‌شود.',
  },
  { icon: Cpu, title: 'انجام تعمیر', text: 'وضعیت تعمیر یا انتظار برای قطعه در سفارش ثبت می‌شود.' },
  {
    icon: CircleCheck,
    title: 'آماده برای تحویل',
    text: 'پس از ثبت وضعیت آماده تحویل، زمان مراجعه را هماهنگ کنید.',
  },
]
const questions = [
  {
    question: 'وضعیت تعمیر دستگاه را چطور پیگیری کنم؟',
    answer:
      'کد پیگیری درج‌شده روی رسید پذیرش را در بخش «پیگیری سفارش» وارد کنید. آخرین وضعیت ثبت‌شده، مبلغ نهایی و وضعیت پرداخت پس از ثبت تعمیرگاه در این بخش نمایش داده می‌شود.',
  },
  {
    question: 'تعمیر دستگاه چقدر زمان می‌برد؟',
    answer:
      'زمان تعمیر به نتیجهٔ عیب‌یابی و موجودی قطعه بستگی دارد. برای اطلاع از زمان احتمالی تحویل، با تعمیرگاه هماهنگ کنید؛ وضعیت «انتظار برای قطعه» به معنی آماده نبودن دستگاه برای تحویل است.',
  },
  {
    question: 'برای تحویل گرفتن دستگاه چه کاری انجام دهم؟',
    answer:
      'پس از مشاهدهٔ وضعیت «آمادهٔ تحویل»، زمان مراجعه را با تعمیرگاه هماهنگ کنید و رسید پذیرش یا کد پیگیری خود را همراه داشته باشید.',
  },
  {
    question: 'پیامک‌های سفارش برای چه ارسال می‌شوند؟',
    answer:
      'پیامک‌های این سامانه برای اطلاع‌رسانی دربارهٔ سفارش تعمیر دستگاه، از جمله ثبت سفارش و تغییر وضعیت آن هستند. وضعیت سفارش از بخش پیگیری سایت نیز قابل مشاهده است.',
  },
]
export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useLandingMotion(ref)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const track = (code: string) => navigate('/track', { state: { code } })
  return (
    <div ref={ref} className="home-page">
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow" data-hero-reveal>
              <Sun size={18} aria-hidden="true" />
              {site.shopName} / تعمیر و لوازم جانبی موبایل
            </span>
            <h1 data-hero-reveal>
              تعمیر دقیق.
              <br />
              <span>خیالِ آسوده.</span>
            </h1>
            <p data-hero-reveal>
              تعمیر انواع موبایل و فروش لوازم جانبی در {site.shopName}. از پذیرش تا تحویل، مسیر
              تعمیر گوشی‌تان را روشن و قابل پیگیری می‌کنیم.
            </p>
            <div className="hero-actions" data-hero-reveal>
              <Link className="button" to="/track">
                پیگیری دستگاه من <ArrowLeft size={19} />
              </Link>
              <a href="#services" className="hero-service-link">
                آشنایی با خدمات <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-footnote" data-hero-reveal>
              <span>
                <CircleCheck size={15} /> پیگیری بدون حساب کاربری
              </span>
              <span>
                <ClipboardCheck size={15} /> کد اختصاصی هر سفارش
              </span>
            </div>
          </div>
          <div className="home-visual-wrap">
            <HeroVisual />
          </div>
        </div>
      </section>
      <section className="quick-track container" aria-label="پیگیری سریع">
        <div>
          <span className="section-kicker">دستگاهتان پیش ماست؟</span>
          <h2>از همین‌جا پیگیری کنید.</h2>
        </div>
        <TrackingForm onTrack={track} compact />
      </section>
      <section id="services" className="section container services-section">
        <div className="section-heading" data-reveal>
          <div>
            <span className="eyebrow dark">01 / تخصص در جزئیات</span>
            <h2>برای گوشی شما، از بررسی تا تعمیر.</h2>
          </div>
          <p>
            تعمیر انواع موبایل و فروش لوازم جانبی؛
            <br />
            بررسی دستگاه، قدم اول یک تعمیر درست است.
          </p>
        </div>
        <div className="service-grid">
          {site.services.map((service, index) => {
            const Icon = icons[index]
            return (
              <article className="service-item" key={service.title} data-reveal>
                <div className="service-top">
                  <Icon size={29} strokeWidth={1.3} />
                  <span dir="ltr">0{index + 1}</span>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <a href="#contact" aria-label={`پرسش دربارهٔ ${service.title}`}>
                  ارتباط با تعمیرگاه <ArrowUpLeft size={16} />
                </a>
              </article>
            )
          })}
        </div>
      </section>
      <section id="about" className="container about-section" aria-labelledby="about-heading">
        <div className="about-copy" data-reveal>
          <span className="eyebrow dark">
            <Sun size={16} /> دربارهٔ ما
          </span>
          <h2 id="about-heading">
            شهر آفتاب؛
            <br />
            همراه گوشی شما.
          </h2>
          <p>
            {site.shopName} در زمینهٔ تعمیر انواع موبایل و فروش لوازم جانبی موبایل فعالیت می‌کند.
            برای بررسی مشکل گوشی، هماهنگی پذیرش یا پرسش دربارهٔ موجودی لوازم جانبی، در ساعت کاری با
            ما تماس بگیرید.
          </p>
          <p>
            هنگام پذیرش دستگاه، شرح مشکل و اطلاعات آن در پروندهٔ تعمیر ثبت می‌شود. کد اختصاصی سفارش
            کمک می‌کند در هر مرحله از آخرین وضعیت ثبت‌شده باخبر بمانید.
          </p>
          {site.phone && (
            <a className="text-link" href={`tel:${site.phone}`}>
              <Phone size={17} /> تماس با شهر آفتاب <bdi>{site.phone}</bdi>
            </a>
          )}
        </div>
        <div className="home-benefits" data-reveal>
          <div className="home-benefits-title">
            <span>تعمیر با یک مسیر روشن</span>
            <span dir="ltr">REPAIR / TRACK / COLLECT</span>
          </div>
          <div className="principle-row">
            <Eye size={22} />
            <div>
              <h3>وضعیت روشن</h3>
              <p>آخرین وضعیت ثبت‌شده، با یک کد پیگیری.</p>
            </div>
          </div>
          <div className="principle-row">
            <Layers3 size={22} />
            <div>
              <h3>پروندهٔ مشخص</h3>
              <p>اطلاعات دستگاه و مراحل تعمیر در یک پرونده.</p>
            </div>
          </div>
          <div className="principle-row">
            <ClipboardCheck size={22} />
            <div>
              <h3>هزینهٔ قابل مشاهده</h3>
              <p>نمایش مبلغ نهایی و وضعیت پرداخت پس از ثبت.</p>
            </div>
          </div>
          <Link to="/track">
            ورود به بخش پیگیری <ArrowLeft size={17} />
          </Link>
        </div>
      </section>
      <section className="process-section" id="process">
        <div className="container">
          <div className="section-heading" data-reveal>
            <div>
              <span className="eyebrow">02 / مسیر تعمیر</span>
              <h2>چهار گام تا تحویل دستگاه.</h2>
            </div>
            <p>
              هر مرحله ثبت می‌شود.
              <br />
              شما هم از وضعیت فعلی باخبر می‌مانید.
            </p>
          </div>
          <ol className="process-grid">
            {steps.map((step, i) => (
              <li key={step.title} data-reveal>
                <span className="step-number">
                  ۰{String(i + 1).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}
                </span>
                <step.icon size={27} strokeWidth={1.3} />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="container home-support">
        <section id="faq" className="faq-section" aria-labelledby="faq-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow dark">پیش از مراجعه</span>
              <h2 id="faq-heading">پرسش‌های متداول</h2>
            </div>
            <p>راهنمای پذیرش، پیگیری و تحویل دستگاه.</p>
          </div>
          <div className="faq-list">
            {questions.map(({ question, answer }, index) => (
              <details key={question} open={index === 0}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="contact" className="contact-section" aria-labelledby="contact-heading">
          <div className="contact-grid">
            <div>
              <span className="eyebrow">تماس با ما</span>
              <h2 id="contact-heading">پیش از مراجعه، هماهنگ کنیم.</h2>
              <p>
                برای پرسش دربارهٔ خدمات، پذیرش دستگاه و هماهنگی تحویل با {site.shopName} در ارتباط
                باشید.
              </p>
              {site.phone && (
                <a className="home-contact-phone" href={`tel:${site.phone}`}>
                  <Phone size={24} aria-hidden="true" />
                  <bdi>{site.phone}</bdi>
                  <ArrowUpLeft size={20} aria-hidden="true" />
                </a>
              )}
            </div>
            <dl className="contact-details">
              {site.address && (
                <div>
                  <MapPin aria-hidden="true" size={22} />
                  <dt>آدرس مراجعه</dt>
                  <dd>{site.address}</dd>
                </div>
              )}
              {site.hours && (
                <div>
                  <Clock3 aria-hidden="true" size={22} />
                  <dt>ساعت پاسخ‌گویی و مراجعه</dt>
                  <dd>{site.hours}</dd>
                </div>
              )}
            </dl>
            <Link className="text-link" to="/track">
              سفارش ثبت‌شده دارید؟ پیگیری کنید <ArrowLeft size={17} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
