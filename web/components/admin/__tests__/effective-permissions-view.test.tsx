import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import messages from '@/messages/en.json'
import type { Permission } from '@/types/database'
import { usePermissions } from '@/hooks/usePermissions'
import { EffectivePermissionsView } from '../effective-permissions-view'

// next/navigation is unresolvable by vitest's native ESM loader; stub our i18n Link so components render in jsdom.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props} />
  ),
}))

vi.mock('@/hooks/usePermissions')

const mockUsePermissions = vi.mocked(usePermissions)

const catalog: Permission[] = [
  {
    key: 'photos.view',
    name: 'View photos',
    description: 'View project photos',
    category: 'photos',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    key: 'photos.upload',
    name: 'Upload photos',
    description: 'Upload project photos',
    category: 'photos',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    key: 'users.manage',
    name: 'Manage users',
    description: 'Manage team members',
    category: 'users',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    key: 'reports.export',
    name: 'Export reports',
    description: 'Export project reports',
    category: 'reports',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    key: 'custom.thing',
    name: 'Custom action',
    description: 'Unknown category permission',
    category: 'custom_category',
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

function mockHook(overrides: Partial<ReturnType<typeof usePermissions>> = {}) {
  mockUsePermissions.mockReturnValue({
    permissions: [],
    allPermissions: [],
    isLoading: false,
    error: null,
    hasPermission: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  })
}

describe('EffectivePermissionsView', () => {
  beforeEach(() => {
    mockHook()
  })

  it('renders the section title and subtitle', () => {
    renderWithIntl(<EffectivePermissionsView />)

    expect(
      screen.getByRole('heading', { name: 'Effective permissions' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Permissions granted to your role'),
    ).toBeInTheDocument()
  })

  it('shows skeleton lines while loading', () => {
    mockHook({ isLoading: true })

    const { container } = renderWithIntl(<EffectivePermissionsView />)

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    expect(screen.queryByText('No permissions granted.')).not.toBeInTheDocument()
  })

  it('shows an error alert when loading fails', () => {
    mockHook({ error: 'Failed to load permissions' })

    renderWithIntl(<EffectivePermissionsView />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to load permissions',
    )
  })

  it('shows the empty state when no permissions are granted', () => {
    mockHook({ allPermissions: catalog })

    renderWithIntl(<EffectivePermissionsView />)

    expect(screen.getByText('No permissions granted.')).toBeInTheDocument()
  })

  it('groups granted permissions by category and renders only granted ones', () => {
    mockHook({
      permissions: ['photos.view', 'users.manage', 'custom.thing'],
      allPermissions: catalog,
    })

    const { container } = renderWithIntl(<EffectivePermissionsView />)

    // Known categories get their translated label.
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('User Management')).toBeInTheDocument()

    // Unknown categories fall back to the raw category string.
    expect(screen.getByText('custom_category')).toBeInTheDocument()

    // Granted permission names render with a Check icon each.
    expect(screen.getByText('View photos')).toBeInTheDocument()
    expect(screen.getByText('Manage users')).toBeInTheDocument()
    expect(screen.getByText('Custom action')).toBeInTheDocument()
    expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(3)

    // Non-granted permissions are not rendered.
    expect(screen.queryByText('Upload photos')).not.toBeInTheDocument()
    expect(screen.queryByText('Export reports')).not.toBeInTheDocument()

    // View-all link points to the user management page.
    const link = screen.getByRole('link', { name: 'View all' })
    expect(link).toHaveAttribute('href', '/admin/users')
  })
})
