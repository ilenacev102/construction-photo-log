import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import BackButton from '@/components/BackButton'

const CONTENT: Record<
  string,
  {
    title: string
    subtitle: string
    lastUpdated: string
    sections: { heading: string; body: string }[]
    reviewNote: string
  }
> = {
  en: {
    title: 'Cookie Policy',
    subtitle: 'Information regarding the use of cookies and local browser storage in Construction Photo Log.',
    lastUpdated: 'August 2026',
    reviewNote: '[TECHNICAL SPECIFICATION — Verified: Essential auth & session cookies only]',
    sections: [
      {
        heading: '1. What Are Cookies',
        body: 'Cookies are small text files placed on your device by websites that you visit. They are widely used to make web applications function reliably and securely.',
      },
      {
        heading: '2. Essential Cookies We Use',
        body: 'We strictly use essential cookies required for core platform functionality: (1) Supabase authentication tokens (`sb-*-auth-token`) to maintain your secure authenticated login session, (2) locale preference cookies to preserve your selected language interface, and (3) CSRF security protection cookies.',
      },
      {
        heading: '3. No Third-Party Tracking or Advertising Cookies',
        body: 'Construction Photo Log does NOT deploy third-party advertising cookies, cross-site behavioral tracking beacons, or commercial retargeting pixels.',
      },
      {
        heading: '4. Managing Browser Cookies',
        body: 'You can configure your browser to block or alert you about cookies. Note that disabling essential authentication cookies will prevent you from signing in and accessing project workspaces.',
      },
    ],
  },
  mk: {
    title: 'Политика за колачиња',
    subtitle: 'Информации за употребата на колачиња во Construction Photo Log.',
    lastUpdated: 'Август 2026',
    reviewNote: '[ТЕХНИЧКА СПЕЦИФИКАЦИЈА — Само неопходни колачиња за автентикација]',
    sections: [
      {
        heading: '1. Што се колачиња',
        body: 'Колачињата се мали текстуални датотеки кои се зачувуваат на вашиот уред за правилно функционирање на веб апликацијата.',
      },
      {
        heading: '2. Неопходни колачиња што ги користиме',
        body: 'Користиме исклучиво неопходни колачиња за безбедна најава, одржување на сесијата и зачувување на избраниот јазик.',
      },
      {
        heading: '3. Без рекламни колачиња',
        body: 'Апликацијата не користи рекламни или колачиња за следење од трети страни.',
      },
    ],
  },
  de: {
    title: 'Cookie-Richtlinie',
    subtitle: 'Informationen zur Verwendung von technisch notwendigen Cookies.',
    lastUpdated: 'August 2026',
    reviewNote: '[TECHNISCHE SPEZIFIKATION]',
    sections: [
      {
        heading: '1. Was sind Cookies',
        body: 'Cookies sind kleine Textdateien, die im Browser zur Session-Verwaltung gespeichert werden.',
      },
      {
        heading: '2. Notwendige Cookies',
        body: 'Wir verwenden ausschließlich technisch notwendige Cookies für die Benutzerauthentifizierung und Spracheinstellungen.',
      },
      {
        heading: '3. Keine Werbe-Cookies',
        body: 'Es werden keine Marketing- oder Tracking-Cookies von Drittanbietern eingesetzt.',
      },
    ],
  },
  sl: {
    title: 'Pravilnik o piškotkih',
    subtitle: 'Informacije o uporabi nujnih piškotkov.',
    lastUpdated: 'Avgust 2026',
    reviewNote: '[TEHNIČNA SPECIFIKACIJA]',
    sections: [
      {
        heading: '1. O piškotkih',
        body: 'Piškotki so datoteke, ki omogočajo varno delovanje aplikacije.',
      },
      {
        heading: '2. Nujni piškotki',
        body: 'Uporabljamo izključno piškotke za prijavo in shranjevanje jezikovnih nastavitev.',
      },
    ],
  },
  sr: {
    title: 'Politika kolačića',
    subtitle: 'Informacije o upotrebi kolačića na platformi.',
    lastUpdated: 'Avgust 2026',
    reviewNote: '[TEHNIČKA SPECIFIKACIJA]',
    sections: [
      {
        heading: '1. Šta su kolačići',
        body: 'Kolačići omogućavaju pravilno i bezbedno funkcionisanje aplikacije.',
      },
      {
        heading: '2. Neophodni kolačići',
        body: 'Koristimo samo kolačiće neophodne za autentifikaciju korisnika i izbor jezika.',
      },
    ],
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const content = CONTENT[locale] ?? CONTENT.en

  return {
    title: `${content.title} | Construction Photo Log`,
    description: content.subtitle,
  }
}

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const common = await getTranslations({ locale, namespace: 'common' })
  const content = CONTENT[locale] ?? CONTENT.en

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 animate-fade-in-up">
      <div className="mb-6">
        <BackButton href="/" label={common('backHome')} />
      </div>

      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{content.title}</h1>
        <p className="mt-2 text-muted-foreground">{content.subtitle}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Last updated: {content.lastUpdated}</span>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-accent/30 bg-accent-muted/40 p-3 text-xs font-medium text-accent">
        {content.reviewNote}
      </div>

      <div className="mt-8 space-y-8">
        {content.sections.map((section, idx) => (
          <section key={idx} className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {section.heading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
