import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { demoCta, primaryNav } from '../data/navigation'
import { useScrolled } from '../hooks/useScrolled'
import { cn } from '../lib/cn'
import { ClayButton } from './ui/ClayButton'
import { Logo } from './ui/Logo'

/** Floating clay navigation bar. Compacts on scroll; collapses to a menu on small screens. */
export function Navbar() {
  const scrolled = useScrolled()
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onResize = () => window.innerWidth >= 1024 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Primary"
        className={cn(
          'pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full bg-surface transition-all duration-300 ease-(--ease-soft)',
          '[box-shadow:var(--clay-shadow-soft)]',
          scrolled ? 'h-14 px-2.5 pl-4 sm:h-[60px] sm:pl-5' : 'h-16 px-3 pl-4 sm:h-[72px] sm:pl-6',
        )}
      >
        <a href="#top" className="rounded-full" aria-label="Vyapaar Mitra home">
          <Logo compact={scrolled} />
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-4 py-2 text-[15px] font-medium text-slate transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ClayButton
            href={demoCta.href}
            size={scrolled ? 'sm' : 'md'}
            trailingIcon={<ArrowRight className="size-4" />}
            className="max-sm:h-10 max-sm:px-4 max-sm:text-sm max-sm:[&>span:last-child]:hidden"
          >
            {demoCta.label}
          </ClayButton>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="clay-button inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center bg-well text-ink lg:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="clay-card pointer-events-auto mx-auto mt-3 max-w-6xl p-3 lg:hidden"
          >
            <ul className="flex flex-col">
              {primaryNav.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-medium text-ink transition-colors hover:bg-surface-2"
                  >
                    {link.label}
                    <ArrowRight aria-hidden className="size-4 text-accent-ink" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
