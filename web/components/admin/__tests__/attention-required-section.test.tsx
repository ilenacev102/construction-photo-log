import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import messages from '@/messages/en.json'
import type { AttentionItem } from '@/lib/admin/overview'
import { AttentionRequiredSection } from '../attention-required-section'

function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe('AttentionRequiredSection', () => {
  it('renders the section title and empty state when there are no items', () => {
    renderWithIntl(<AttentionRequiredSection items={[]} />)

    expect(
      screen.getByRole('heading', { name: 'Attention required' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('All limits within range. No action needed.'),
    ).toBeInTheDocument()
  })

  it('renders skeleton rows instead of content while loading', () => {
    const { container } = renderWithIntl(
      <AttentionRequiredSection items={[]} isLoading />,
    )

    expect(
      screen.getByRole('heading', { name: 'Attention required' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('All limits within range. No action needed.'),
    ).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('renders a critical reached item title with interpolated values', () => {
    const items: AttentionItem[] = [
      { id: 'seats-reached', kind: 'seats-reached', severity: 'critical', used: 10, limit: 10 },
    ]

    renderWithIntl(<AttentionRequiredSection items={items} />)

    expect(screen.getByText('Team seats at limit (10 of 10)')).toBeInTheDocument()
  })

  it('renders usage-limit items without any pricing or billing action', () => {
    const items: AttentionItem[] = [
      {
        id: 'photos-near',
        kind: 'photos-near',
        severity: 'warning',
        used: 8,
        limit: 10,
        percent: 80,
      },
    ]

    renderWithIntl(<AttentionRequiredSection items={items} />)

    expect(screen.getByText('Photos near limit (80%)')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
