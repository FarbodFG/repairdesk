import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
export function useLandingMotion(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('[data-hero-reveal]', {
          y: 20,
          opacity: 0,
          duration: 0.65,
          stagger: 0.1,
          ease: 'power2.out',
          clearProps: 'all',
        })
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 24,
            opacity: 0,
            duration: 0.6,
            scrollTrigger: { trigger: element, start: 'top 92%', once: true },
            clearProps: 'all',
          })
        })
        gsap.to('.hero-model', {
          y: 28,
          rotate: 2,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
        })
      }, ref)
      return () => context.revert()
    })
    return () => media.revert()
  }, [ref])
}
