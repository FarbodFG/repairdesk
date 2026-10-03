import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUpLeft,
  Smartphone,
  BatteryCharging,
  Cpu,
  Settings2,
  ScanLine,
  ClipboardCheck,
  CircleCheck,
  Eye,
  Layers3,
} from 'lucide-react'
import { HeroVisual } from './HeroVisual'
import { TrackingForm } from '../tracking/TrackingForm'
import { site } from '../../config/site'
import { useLandingMotion } from '../../lib/animations/useLandingMotion'
const icons = [Smartphone, BatteryCharging, Cpu, Settings2]
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
    <div ref={ref}>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow" data-hero-reveal>
              <span className="live-dot" />
              به جزئیات برمی‌گردیم.
            </span>
            <h1 data-hero-reveal>
              تعمیر دقیق.
              <br />
              <span>خیالِ آسوده.</span>
            </h1>
            <p data-hero-reveal>
              گوشی شما، بخشی از زندگی شماست.
              <br />
              از اولین بررسی تا لحظه تحویل،
              <br />
              مسیر تعمیرش را روشن و قابل پیگیری می‌کنیم.
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
              <span>دقت در کار.</span>
              <span>شفافیت در مسیر.</span>
              <span>توجه به جزئیات.</span>
            </div>
          </div>
          <HeroVisual />
        </div>
        <div className="container hero-baseline">
          <span dir="ltr">REPAIRDESK / PRECISION WORKSHOP</span>
          <span>یک نگاه نزدیک‌تر، یک تعمیر آگاهانه‌تر.</span>
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
            <h2>
              برای هر مشکل،
              <br />
              از جای درست شروع می‌کنیم.
            </h2>
          </div>
          <p>
            از چیزی که می‌بینید تا قطعاتی که نمی‌بینید؛
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
                <ArrowUpLeft size={19} />
              </article>
            )
          })}
        </div>
        <p className="small muted service-notice">{site.servicesNotice}</p>
      </section>
      <section className="process-section" id="process">
        <div className="container">
          <div className="section-heading" data-reveal>
            <div>
              <span className="eyebrow">02 / مسیر تعمیر</span>
              <h2>
                از «مشکل دارد»
                <br />
                تا «آماده تحویل است».
              </h2>
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
      <section className="section container principles">
        <div className="principle-visual" data-reveal>
          <div className="inspection-ring">
            <Smartphone size={105} strokeWidth={0.65} />
            <span className="inspection-cross a">+</span>
            <span className="inspection-cross b">+</span>
          </div>
          <div className="inspection-caption">
            <span>توجه به چیزی که مهم است.</span>
            <b dir="ltr">THE DETAILS.</b>
          </div>
        </div>
        <div data-reveal>
          <span className="eyebrow dark">03 / شفاف، در هر مرحله</span>
          <h2>
            اعتماد،
            <br />
            از شفافیت شروع می‌شود.
          </h2>
          <div className="principle-row">
            <Eye size={22} />
            <div>
              <h3>وضعیت روشن، بدون حدس و گمان</h3>
              <p>آخرین وضعیت ثبت‌شده سفارش را با کد پیگیری ببینید.</p>
            </div>
          </div>
          <div className="principle-row">
            <Layers3 size={22} />
            <div>
              <h3>جزئیات، در یک پرونده</h3>
              <p>اطلاعات دستگاه و تغییرات وضعیت در پرونده تعمیر ثبت می‌شوند.</p>
            </div>
          </div>
          <div className="principle-row">
            <ClipboardCheck size={22} />
            <div>
              <h3>مبلغ و پرداخت مشخص</h3>
              <p>مبلغ نهایی پس از ثبت تعمیرگاه، همراه وضعیت پرداخت قابل مشاهده است.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="container tracking-cta" data-reveal>
        <div>
          <span className="eyebrow dark">یک کد، یک مسیر روشن</span>
          <h2>از گوشی‌تان خبر بگیرید.</h2>
          <p>کد پیگیری روی رسید پذیرش را همراه داشته باشید.</p>
        </div>
        <Link className="button dark-button" to="/track">
          پیگیری وضعیت تعمیر <ArrowLeft size={19} />
        </Link>
      </section>
      <section className="container staff-cta">
        <div>
          <h3>عضو تیم تعمیرگاه هستید؟</h3>
          <p>سفارش‌ها، مشتریان و کارهای امروز در فضای کاری شما.</p>
        </div>
        <Link to="/login" className="text-link">
          ورود به فضای کاری <ArrowUpLeft size={18} />
        </Link>
      </section>
    </div>
  )
}
