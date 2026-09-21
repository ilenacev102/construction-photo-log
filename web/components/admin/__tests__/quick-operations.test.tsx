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
  it('renders the title and all five operation links with the correct hrefs and labels', () => {
    renderWithIntl(<QuickOperations />)

    expect(
      screen.getByRole('heading', { name: 'Quick operations' }),
    ).toBeInTheDocument()

    const expected = [
      { name: 'Manage users', href: '/admin/users' },
      { name: 'Team', href: '/admin/team' },
      { name: 'Audit log', href: '/admin/audit' },
      { name: 'Labels', href: '/admin/labels' },
      { name: 'Billing & plan', href: '/admin/billing' },
    ]

    for (const { name, href } of expected) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
    }
  })
})
