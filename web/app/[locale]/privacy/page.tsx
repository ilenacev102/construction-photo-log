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
    title: 'Privacy Policy',
    subtitle: 'How Construction Photo Log processes, stores, and protects field documentation data.',
    lastUpdated: 'August 2026',
    legalNote: '[LEGAL REVIEW REQUIRED — Formal legal counsel review pending for enterprise jurisdictional terms.]',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect account credentials (email address, full name), organization identity, uploaded construction field photographs, EXIF camera metadata (timestamps, camera model, exposure settings), GPS location coordinates embedded in uploaded photos or recorded during attendance check-in, defect annotations, and daily activity logs.',
      },
      {
        heading: '2. Purpose of Processing',
        body: 'Collected information is processed exclusively to deliver field documentation services: associating photos with architectural blueprints, establishing project timelines, managing punch list defects, calculating crew attendance, generating PDF field reports, and maintaining an immutable operational audit log for dispute defense.',
      },
      {
        heading: '3. Data Storage & Multi-Tenant Isolation',
        body: 'Customer data is partitioned using database Row Level Security (RLS) policies and tenant-scoped object storage. Uploaded photographs and schema files are accessed exclusively through short-lived signed URLs generated on authenticated demand.',
      },
      {
        heading: '4. Third-Party Processors',
        body: 'We use verified infrastructure providers to deliver services: Supabase (database hosting, authentication, and encrypted object storage) and Stripe (payment processing and subscription billing). We do not sell, rent, or monetize customer documentation data.',
      },
      {
        heading: '5. Data Retention & Export',
        body: 'Project documentation and audit logs remain stored for the duration of the active subscription or until explicitly deleted by an organization administrator. Authorized company administrators can export project records and generated PDF reports at any time.',
      },
      {
        heading: '6. Account Deletion & Right to Erasure',
        body: 'Users and organization owners may request full account deletion and data erasure by contacting support or via administrator controls. Upon confirmation, tenant data and associated storage objects are permanently purged from active databases.',
      },
    ],
  },
  mk: {
    title: 'Политика за приватност',
    subtitle: 'Како Construction Photo Log ги обработува, чува и штити податоците од теренската документација.',
    lastUpdated: 'Август 2026',
    legalNote: '[ПОТРЕБЕН ПРАВЕН ПРЕГЛЕД — Формален правен преглед за деловни услови.]',
    sections: [
      {
        heading: '1. Податоци што ги собираме',
        body: 'Собираме податоци за кориснички сметки (е-пошта, име и презиме), податоци за организацијата, прикачени теренски фотографии, EXIF метаподатоци (датум, време, модел на камера), GPS координати од фотографии и евиденција на присуство, дефекти и дневни градежни дневници.',
      },
      {
        heading: '2. Цел на обработката',
        body: 'Собраните информации се користат исклучиво за обезбедување на услугата: поврзување на фотографии со градежни шеми, водење временска линија на проекти, управување со дефекти, евиденција на присуство и генерирање на PDF извештаи.',
      },
      {
        heading: '3. Чување на податоци и безбедност',
        body: 'Податоците на клиентите се изолирани преку безбедносни полиси на ниво на ред (Row Level Security) и безбеден складиштен простор со пристап преку временски ограничени потпишани врски.',
      },
      {
        heading: '4. Трети страни и процесори',
        body: 'Користиме доверливи инфраструктурни платформи: Supabase (база на податоци, автентикација и складирање) и Stripe (процесирање на плаќања). Не продаваме ниту споделуваме кориснички податоци за рекламни цели.',
      },
      {
        heading: '5. Задржување и извоз на податоци',
        body: 'Документацијата се чува за време на активното користење на услугата. Овластените администратори можат да извезат комплетни извештаи и податоци во секое време.',
      },
      {
        heading: '6. Бришење на кориснички сметки',
        body: 'Корисниците имаат право да побараат целосно бришење на нивната сметка и придружните податоци од системот.',
      },
    ],
  },
  de: {
    title: 'Datenschutzerklärung',
    subtitle: 'Wie Construction Photo Log Baustellendokumentationen verarbeitet, speichert und schützt.',
    lastUpdated: 'August 2026',
    legalNote: '[JURISTISCHE PRÜFUNG ERFORDERLICH]',
    sections: [
      {
        heading: '1. Erfasste Daten',
        body: 'Wir erfassen Kontoinformationen, Projektdaten, Baustellenfotos, EXIF-Metadaten (Zeitstempel, GPS-Koordinaten), Mängelberichte und Bautagebücher.',
      },
      {
        heading: '2. Zweck der Verarbeitung',
        body: 'Die Verarbeitung dient ausschließlich der Bereitstellung von baudokumentarischen Diensten, Mängelverfolgung, Anwesenheitskontrolle und PDF-Berichtserstellung.',
      },
      {
        heading: '3. Datensicherheit & Mandantentrennung',
        body: 'Mandantendaten werden durch datenbankbasierte Zugriffskontrollen (RLS) und signierte temporäre Speicher-URLs geschützt.',
      },
      {
        heading: '4. Auftragsverarbeiter',
        body: 'Wir setzen Supabase (Datenbank & Speicher) und Stripe (Zahlungsabwicklung) ein. Kundendaten werden nicht an Dritte veräußert.',
      },
      {
        heading: '5. Datenspeicherung & Export',
        body: 'Daten werden während der Vertragslaufzeit gespeichert und können jederzeit als PDF oder Rohdaten exportiert werden.',
      },
      {
        heading: '6. Kontolöschung',
        body: 'Nutzer können die vollständige Löschung ihres Kontos und aller zugehörigen Projektdaten verlangen.',
      },
    ],
  },
  sl: {
    title: 'Pravilnik o zasebnosti',
    subtitle: 'Kako Construction Photo Log obdeluje, hrani in ščiti podatke gradbene dokumentacije.',
    lastUpdated: 'Avgust 2026',
    legalNote: '[POTREBEN PRAVNI PREGLED]',
    sections: [
      {
        heading: '1. Zbrani podatki',
        body: 'Zbiramo podatke o računih, gradbenih fotografijah, EXIF metapodatkih (čas, GPS koordinate), opombah o napakah in dnevnikih del.',
      },
      {
        heading: '2. Namen obdelave',
        body: 'Podatki se obdelujejo izključno za vodenje gradbene dokumentacije, načrtovanje napak in izdelavo PDF poročil.',
      },
      {
        heading: '3. Hramba in varnost podatkov',
        body: 'Podatki so ločeni z varnostnimi politikami na nivoju baze in zaščitenimi podpisanimi povezavami.',
      },
      {
        heading: '4. Zunanji obdelovalci',
        body: 'Uporabljamo preverjene storitve: Supabase (podatkovna baza in hramba) ter Stripe (plačilni promet).',
      },
      {
        heading: '5. Izvoz in brisanje podatkov',
        body: 'Uporabniki lahko kadarkoli izvozijo podatke ali zahtevajo popoln izbris računa.',
      },
    ],
  },
  sr: {
    title: 'Politika privatnosti',
    subtitle: 'Kako Construction Photo Log obrađuje, čuva i štiti podatke terenske dokumentacije.',
    lastUpdated: 'Avgust 2026',
    legalNote: '[POTREBAN PRAVNI PREGLED]',
    sections: [
      {
        heading: '1. Podaci koje prikupljamo',
        body: 'Prikupljamo podatke o korisničkim nalozima, terenskim fotografijama, EXIF metapodacima (datum, vreme, GPS koordinate), zabeleženim defektima i dnevnicima rada.',
      },
      {
        heading: '2. Svrha obrade',
        body: 'Podaci se koriste isključivo za dokumentovanje gradilišta, praćenje nedostataka, evidenciju prisustva i generisanje PDF izveštaja.',
      },
      {
        heading: '3. Čuvanje i bezbednost',
        body: 'Podaci su izolovani putem bezbednosnih polisa na nivou baze podataka (RLS) i zaštićeni potpisanim vezama.',
      },
      {
        heading: '4. Eksterni procesori',
        body: 'Koristimo pouzdane platforme: Supabase (baza i skladište) i Stripe (naplata). Podatke ne delimo u marketinške svrhe.',
      },
      {
        heading: '5. Izvoz i brisanje podataka',
        body: 'Korisnici mogu izvesti izveštaje ili zatražiti trajno brisanje naloga i podataka.',
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

export default async function PrivacyPage({
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
