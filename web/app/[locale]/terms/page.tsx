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
    legalNote: string
  }
> = {
  en: {
    title: 'Terms of Service',
    subtitle: 'Commercial terms, usage policies, and service obligations for Construction Photo Log.',
    lastUpdated: 'August 2026',
    legalNote: '[LEGAL REVIEW REQUIRED — Formal legal counsel review pending for enterprise subscription SLAs.]',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing or using Construction Photo Log, you agree to be bound by these Terms of Service. If you are entering into these terms on behalf of a company or organization, you represent that you possess the authority to bind that entity.',
      },
      {
        heading: '2. Customer Data Ownership',
        body: 'You retain full and exclusive ownership of all photographs, architectural drawings, annotations, logs, and project data uploaded to the platform. Construction Photo Log does not claim any intellectual property rights over your project content.',
      },
      {
        heading: '3. Acceptable Use',
        body: 'You agree to use the service in compliance with all applicable laws and regulations. You shall not attempt to reverse engineer, disrupt system infrastructure, probe API security boundaries without authorization, or upload malicious files.',
      },
      {
        heading: '4. Subscriptions, Seats & Billing',
        body: 'Subscription fees are billed in advance on a recurring monthly or annual basis in accordance with selected plan tiers (Crew, Team, Company). Seat limits, storage allocations, and feature access are enforced according to active plan parameters.',
      },
      {
        heading: '5. Limitation of Liability',
        body: 'Construction Photo Log provides field documentation tools to assist project tracking. The service does not replace certified structural inspections, licensed architectural verifications, or mandatory municipal compliance audits.',
      },
      {
        heading: '6. Termination & Cancellation',
        body: 'Organization administrators may cancel subscriptions at any time via billing settings. Upon cancellation, access continues until the end of the current billing period, with export options available prior to account termination.',
      },
    ],
  },
  mk: {
    title: 'Услови за користење',
    subtitle: 'Комерцијални услови, правила за користење и обврски на Construction Photo Log.',
    lastUpdated: 'Август 2026',
    legalNote: '[ПОТРЕБЕН ПРАВЕН ПРЕГЛЕД]',
    sections: [
      {
        heading: '1. Прифаќање на условите',
        body: 'Со пристапување и користење на апликацијата, се согласувате со овие Услови за користење.',
      },
      {
        heading: '2. Сопственост врз податоците',
        body: 'Вие ја задржувате целосната и ексклузивна сопственост врз сите фотографии, градежни шеми и проекти прикачени на платформата.',
      },
      {
        heading: '3. Правила за користење',
        body: 'Се согласувате да ја користите платформата во согласност со важечките закони и регулативи.',
      },
      {
        heading: '4. Претплати и наплата',
        body: 'Претплатите се наплаќаат според избраниот план и број на корисници преку официјалниот процесор на плаќања.',
      },
      {
        heading: '5. Ограничување на одговорност',
        body: 'Апликацијата служи за фото-документација и не заменува официјален градежен и статички надзор од овластени инженери.',
      },
      {
        heading: '6. Откажување',
        body: 'Претплатата може да се откаже во секое време од страна на администраторот на организацијата.',
      },
    ],
  },
  de: {
    title: 'Nutzungsbedingungen',
    subtitle: 'Vertragsbedingungen und Servicevereinbarungen für Construction Photo Log.',
    lastUpdated: 'August 2026',
    legalNote: '[JURISTISCHE PRÜFUNG ERFORDERLICH]',
    sections: [
      {
        heading: '1. Geltungsbereich',
        body: 'Mit der Nutzung von Construction Photo Log akzeptieren Sie diese allgemeinen Geschäftsbedingungen.',
      },
      {
        heading: '2. Dateneigentum',
        body: 'Der Kunde bleibt alleiniger Eigentümer aller hochgeladenen Fotos, Baupläne und Projektdaten.',
      },
      {
        heading: '3. Pflichten des Nutzers',
        body: 'Die Plattform darf nur im Einklang mit geltenden Gesetzen und Bauvorschriften genutzt werden.',
      },
      {
        heading: '4. Abonnements & Abrechnung',
        body: 'Die Vergütung richtet sich nach dem gewählten Tarif und wird im Voraus abgerechnet.',
      },
      {
        heading: '5. Haftungsbeschränkung',
        body: 'Die Software dient der internen Dokumentation und ersetzt keine amtliche Bauabnahme.',
      },
    ],
  },
  sl: {
    title: 'Pogoji uporabe',
    subtitle: 'Pogoji poslovanja in pravila storitve za Construction Photo Log.',
    lastUpdated: 'Avgust 2026',
    legalNote: '[POTREBEN PRAVNI PREGLED]',
    sections: [
      {
        heading: '1. Sprejem pogojev',
        body: 'Z uporabo platforme se strinjate s temi pogoji poslovanja.',
      },
      {
        heading: '2. Lastništvo podatkov',
        body: 'Naročnik obdrži polno lastništvo nad vsemi naloženimi gradbenimi fotografijami in načrti.',
      },
      {
        heading: '3. Naročnine in plačila',
        body: 'Plačila se izvajajo v skladu z izbranim paketom storitev.',
      },
      {
        heading: '4. Omejitev odgovornosti',
        body: 'Storitev je namenjena vodenju dokumentacije in ne nadomešča uradnega gradbenega nadzora.',
      },
    ],
  },
  sr: {
    title: 'Uslovi korišćenja',
    subtitle: 'Pravila korišćenja i uslovi pretplate za Construction Photo Log.',
    lastUpdated: 'Avgust 2026',
    legalNote: '[POTREBAN PRAVNI PREGLED]',
    sections: [
      {
        heading: '1. Prihvatanje uslova',
        body: 'Korišćenjem platforme prihvatate ove Uslove korišćenja.',
      },
      {
        heading: '2. Vlasništvo nad podacima',
        body: 'Korisnik zadržava puno vlasništvo nad svim postavljenim fotografijama, nacrtima i izveštajima.',
      },
      {
        heading: '3. Pretplate i plaćanje',
        body: 'Pretplate se obračunavaju na mesečnom ili godišnjem nivou u skladu sa odabranim paketom.',
      },
      {
        heading: '4. Ograničenje odgovornosti',
        body: 'Aplikacija je alat za dokumentovanje i ne zamenjuje licencirani građevinski nadzor.',
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

export default async function TermsPage({
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
        {content.legalNote}
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
