import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import messages from '@/messages/en.json'
import { QuickOperations } from '../quick-operations'

// next/navigation is unresolvable by vitest's native ESM loader; stub our i18n Link so components render in jsdom.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props} />
  ),
}))

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe('QuickOperations', () => {
  it('renders the title and every operation link points at a real admin page', () => {
    renderWithIntl(<QuickOperations />)

    expect(
      screen.getByRole('heading', { name: 'Quick operations' }),
    ).toBeInTheDocument()

    const expected = [
      { name: 'Manage users', href: '/admin/users' },
      { name: 'Team', href: '/admin/team' },
      { name: 'Audit log', href: '/admin/audit' },
      { name: 'Labels', href: '/admin/labels' },
    ]

    for (const { name, href } of expected) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
    }

    // Regression guard for P1-21: /admin/billing was linked from here with no
    // page behind it, and this test locked the bug in by asserting the href.
    // vitest runs with web/ as the working directory; import.meta.url is not a
    // file: URL under jsdom, so fileURLToPath() throws there.
    const webRoot = process.cwd()
    const rendered = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'))

    expect(rendered.length).toBeGreaterThan(0)
    for (const href of rendered) {
      const page = href === '/admin' ? 'admin/page.tsx' : `${href.replace(/^\//, '')}/page.tsx`
      expect(existsSync(join(webRoot, 'app/[locale]', page)), `${href} has no page.tsx`).toBe(
        true,
      )
    }
  })
})
