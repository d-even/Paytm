import type { ReactNode } from 'react'
import { useNavigationType } from 'react-router-dom'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useFocusOnMount } from '../../hooks/useFocusOnMount'

/**
 * Title block at the top of every app screen. It names the browser tab, and
 * after an in-app navigation (sign-in, the sidebar, sign-out) it takes focus,
 * so the merchant starts on the new screen instead of back at the top of the page.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  visuallyHidden = false,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** For screens whose name is already in the app header (the Counter): kept for screen readers and focus. */
  visuallyHidden?: boolean
}) {
  // POP is the first load or back/forward, where the browser handles focus and scroll.
  const headingRef = useFocusOnMount<HTMLHeadingElement>(useNavigationType() !== 'POP')
  useDocumentTitle(title)

  if (visuallyHidden) {
    return (
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {title}
      </h1>
    )
  }

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h1 ref={headingRef} tabIndex={-1} className="text-[28px] leading-tight font-bold tracking-[-0.025em] outline-none md:text-[36px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-slate md:text-body-lg">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}
