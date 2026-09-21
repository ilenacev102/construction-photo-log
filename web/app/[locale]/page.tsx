import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import HeroSection from '@/components/HeroSection'
import FeaturesSection from '@/components/FeaturesSection'
import SocialProofSection from '@/components/SocialProofSection'
import CTASection from '@/components/CTASection'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: t('homeTitle'),
    description: t('homeDesc'),
  }
}

export default function Home() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <CTASection />
    </main>
  )
}
