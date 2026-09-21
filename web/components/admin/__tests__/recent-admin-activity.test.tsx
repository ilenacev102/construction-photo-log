import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import messages from '@/messages/en.json'
import type { AuditLog } from '@/types/database'
import { RecentAdminActivity } from '../recent-admin-activity'

// next/navigation is unresolvable by vitest's native ESM loader; stub our i18n Link so components render in jsdom.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props} />
  ),
}))

const logs: AuditLog[] = [
  {
    id: 'log_1',
    project_id: 'proj_1',
    user_id: 'user_1',
    action: 'created',
    entity_type: 'project',
    entity_id: 'proj_1',
    metadata: {},
    created_at: '2026-08-10T09:30:00.000Z',
  },
  {
    id: 'log_2',
    project_id: null,
    user_id: 'user_2',
    action: 'updated',
    entity_type: 'unknown_entity',
    entity_id: null,
    metadata: {},
    created_at: '2026-08-11T14:45:00.000Z',
  },
]

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe('RecentAdminActivity', () => {
  it('renders the section title', () => {
    renderWithIntl(<RecentAdminActivity logs={[]} />)

    expect(
      screen.getByRole('heading', { name: 'Recent activity' }),
    ).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    const { container } = renderWithIntl(
      <RecentAdminActivity logs={[]} isLoading />,
    )

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    expect(screen.queryByText('No recent activity.')).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no logs', () => {
    renderWithIntl(<RecentAdminActivity logs={[]} />)

    expect(screen.getByText('No recent activity.')).toBeInTheDocument()
  })

  it('renders rows with action, formatted timestamp and entity label', () => {
    renderWithIntl(<RecentAdminActivity logs={logs} />)

    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()

    // Known entity type resolves to a translated label.
    expect(screen.getByText('Project')).toBeInTheDocument()

    // Unknown entity type falls back to the raw value.
    expect(screen.getByText('unknown_entity')).toBeInTheDocument()

    // Timestamp is formatted with dateStyle medium + timeStyle short.
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date('2026-08-10T09:30:00.000Z'))
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('renders a view-all link to the audit log', () => {
    renderWithIntl(<RecentAdminActivity logs={logs} />)

    const link = screen.getByRole('link', { name: 'View all' })
    expect(link).toHaveAttribute('href', '/admin/audit')
  })
})
