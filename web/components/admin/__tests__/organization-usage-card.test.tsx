import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import type { UsageMeter } from '@/lib/admin/overview'
import messages from '@/messages/en.json'

import { OrganizationUsageCard } from '../organization-usage-card'

const meters: UsageMeter[] = [
  { key: 'seats', used: 4, limit: 5, unlimited: false, percent: 80, tier: 'warning' },
  { key: 'photos', used: 120, limit: 500, unlimited: false, percent: 24, tier: 'ok' },
  { key: 'projects', used: 3, limit: null, unlimited: true, percent: 0, tier: 'ok' },
]

function renderCard(props: Partial<ComponentProps<typeof OrganizationUsageCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationUsageCard meters={meters} {...props} />
    </NextIntlClientProvider>,
  )
}

describe('OrganizationUsageCard', () => {
  it('renders the card title and meter labels', () => {
    renderCard()

    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(screen.getByText('Team seats')).toBeInTheDocument()
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('renders usage values for limited meters', () => {
    renderCard()

    expect(screen.getByText('4 of 5')).toBeInTheDocument()
    expect(screen.getByText('120 of 500')).toBeInTheDocument()
  })

  it('shows Unlimited for an unlimited meter', () => {
    renderCard()

    expect(screen.getByText('Unlimited')).toBeInTheDocument()
  })

  it('renders the tier badge for each meter', () => {
    renderCard()

    expect(screen.getByText('Near limit')).toBeInTheDocument()
    expect(screen.getAllByText('On track')).toHaveLength(2)
    expect(screen.queryByText('Limit reached')).not.toBeInTheDocument()
  })

  it('renders a critical tier badge', () => {
    renderCard({
      meters: [
        { key: 'photos', used: 500, limit: 500, unlimited: false, percent: 100, tier: 'critical' },
      ],
    })

    expect(screen.getByText('Limit reached')).toBeInTheDocument()
  })

  it('sets progressbar attributes from the meter percent', () => {
    renderCard()

    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(3)
    expect(bars[0]).toHaveAttribute('aria-valuenow', '80')
    expect(bars[0]).toHaveAttribute('aria-valuemin', '0')
    expect(bars[0]).toHaveAttribute('aria-valuemax', '100')
    expect(bars[0]).toHaveAttribute('aria-label', 'Team seats')
    expect(bars[1]).toHaveAttribute('aria-valuenow', '24')
    expect(bars[2]).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders skeleton rows while loading', () => {
    renderCard({ isLoading: true })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(9)
  })

  it('keeps the section header and renders no rows when meters is empty', () => {
    renderCard({ meters: [] })

    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0)
  })
})
