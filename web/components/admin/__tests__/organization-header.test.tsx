import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import messages from '@/messages/en.json'

import { OrganizationHeader } from '../organization-header'

function renderHeader(props: Partial<ComponentProps<typeof OrganizationHeader>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationHeader orgName="Acme Construction" {...props} />
    </NextIntlClientProvider>,
  )
}

describe('OrganizationHeader', () => {
  it('renders the organization name', () => {
    renderHeader()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Acme Construction' }),
    ).toBeInTheDocument()
  })

  it('falls back to the translated title when orgName is null', () => {
    renderHeader({ orgName: null })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Organization command center' }),
    ).toBeInTheDocument()
  })

  it('renders a single skeleton line while loading', () => {
    renderHeader({ isLoading: true })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
  })
})
