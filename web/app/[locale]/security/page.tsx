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
    title: 'Security Architecture',
    subtitle: 'Technical specifications of multi-tenant isolation, access authorization, and data safeguards.',
    lastUpdated: 'August 2026',
    reviewNote: '[TECHNICAL SPECIFICATION — Verified from repository implementation]',
    sections: [
      {
        heading: '1. Multi-Tenant Database Isolation',
        body: 'All database tables in the platform enforce PostgreSQL Row Level Security (RLS) policies. Read and write operations are strictly partitioned by organization identity (company_id) and verified membership roles.',
      },
      {
        heading: '2. Role-Based Access Control (RBAC)',
        body: 'Access to administrative features, member permissions, project deletion, blueprint uploads, and defect modifications is governed by fine-grained role authorization (admin, site_manager, foreman, photographer, client). Privileged operations require server-validated role session checks.',
      },
      {
        heading: '3. Signed Storage URL Protection',
        body: 'Project photographs and architectural blueprint schematics are stored in private object buckets. File access is mediated by short-lived cryptographic signed URLs generated exclusively for authorized project members, eliminating public bucket exposure.',
      },
      {
        heading: '4. Immutable Audit Trail Logging',
        body: 'Critical operations—such as role adjustments, member invitations, defect status transitions, and data modifications—are recorded in an append-only audit trail logging user identity, action type, target entity, and timestamp.',
      },
      {
        heading: '5. Tamper-Aware EXIF Metadata',
        body: 'Uploaded photos retain original EXIF metadata (timestamp of capture, camera hardware identifiers, and GPS coordinates) to establish evidentiary provenance for construction documentation and contractor milestone verification.',
      },
    ],
  },
  mk: {
    title: 'Безбедносна архитектура',
    subtitle: 'Технички спецификации за мулти-тенант изолација, авторизација и заштита на податоци.',
    lastUpdated: 'Август 2026',
    reviewNote: '[ТЕХНИЧКА СПЕЦИФИКАЦИЈА — Верификувана од репозиториумот]',
    sections: [
      {
        heading: '1. Изолација на базата на податоци',
        body: 'Сите табели користат безбедносни полиси на ниво на ред (Row Level Security - RLS) во PostgreSQL, што гарантира строга изолација на податоците меѓу организациите.',
      },
      {
        heading: '2. Контрола на пристап базирана на улоги',
        body: 'Пристапот до администраторски функции, измени на членови, градежни шеми и дефекти е контролиран преку прецизни улоги (admin, site_manager, foreman, photographer, client).',
      },
      {
        heading: '3. Заштита преку потпишани врски за складирање',
        body: 'Фотографиите и шемите се чуваат во приватни складишта и се достапни единствено преку временски ограничени потпишани врски генерирани за овластени членови.',
      },
      {
        heading: '4. Евиденција на сите активности (Audit Trail)',
        body: 'Сите клучни промени во системот (додавање членови, промена на дозволи, статус на дефекти) автоматски се запишуваат во безбеден ревизорски дневник.',
      },
      {
        heading: '5. Зачувување на оригинални EXIF податоци',
        body: 'Системот ги екстрахира и зачувува оригиналните датуми, времиња и GPS координати од фотографиите за обезбедување докази за напредокот на градбата.',
      },
    ],
  },
  de: {
    title: 'Sicherheitsarchitektur',
    subtitle: 'Technische Spezifikationen zu Mandantentrennung und Zugriffskontrolle.',
    lastUpdated: 'August 2026',
    reviewNote: '[TECHNISCHE SPEZIFIKATION]',
    sections: [
      {
        heading: '1. Mandantenisolierung',
        body: 'Alle Datenbanktabellen nutzen PostgreSQL Row Level Security (RLS) zur strikten Trennung der Unternehmensdaten.',
      },
      {
        heading: '2. Rollenbasierte Zugriffskontrolle (RBAC)',
        body: 'Zugriffsrechte für Projektleiter, Bauleiter und Fotografen werden serverseitig über validierte Rollen durchgesetzt.',
      },
      {
        heading: '3. Signierte Speicher-URLs',
        body: 'Fotos und Pläne werden in privaten Buckets gespeichert und ausschließlich über temporär signierte URLs abgerufen.',
      },
      {
        heading: '4. Revisionssicheres Audit-Log',
        body: 'Sicherheitsrelevante Vorgänge werden lückenlos mit Benutzer-ID, Zeitstempel und Aktion protokolliert.',
      },
    ],
  },
  sl: {
    title: 'Varnostna arhitektura',
    subtitle: 'Tehnični podatki o večuporabniški izolaciji in zaščiti podatkov.',
    lastUpdated: 'Avgust 2026',
    reviewNote: '[TEHNIČNA SPECIFIKACIJA]',
    sections: [
      {
        heading: '1. Ločevanje podatkov',
        body: 'PostgreSQL Row Level Security (RLS) zagotavlja popolno ločenost podatkov med podjetji.',
      },
      {
        heading: '2. Nadzor dostopa po vlogah',
        body: 'Varnostni mehanizmi preprečujejo nepooblaščen dostop do načrtov in podatkov.',
      },
      {
        heading: '3. Podpisane povezave za hrambo',
        body: 'Vse datoteke so zaščitene in dostopne le preko začasnih varnostnih povezav.',
      },
    ],
  },
  sr: {
    title: 'Bezbednosna arhitektura',
    subtitle: 'Tehničke specifikacije o izolaciji podataka i bezbednosti sistema.',
    lastUpdated: 'Avgust 2026',
    reviewNote: '[TEHNIČKA SPECIFIKACIJA]',
    sections: [
      {
        heading: '1. Izolacija podataka',
        body: 'PostgreSQL Row Level Security (RLS) osigurava potpunu izolaciju podataka između različitih firmi.',
      },
      {
        heading: '2. Kontrola pristupa',
        body: 'Prava pristupa su strogo definisana kroz korisničke uloge i dozvole.',
      },
      {
        heading: '3. Potpisani linkovi za skladište',
        body: 'Slike i građevinske šeme se preuzimaju isključivo preko vremenski ograničenih potpisanih linkova.',
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

export default async function SecurityPage({
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
          <span>{common('updatedLabel')}: {content.lastUpdated}</span>
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
