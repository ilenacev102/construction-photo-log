import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { getAllPosts } from '@/lib/blog'
import BackButton from '@/components/BackButton'

/**
 * Case-study index page.
 *
 * The posts themselves live in `web/content/blog/` with `type: "case-study"`
 * frontmatter and render through the existing `blog/[slug]` route. This page
 * aggregates them, and the blog index links here. Translation keys are NOT
 * added to `web/messages/*.json` (the i18n edit rule is strict), so the
 * static chrome text lives in this per-locale map instead.
 */
const CONTENT: Record<
  string,
  { title: string; subtitle: string; empty: string }
> = {
  en: {
    title: 'Case Studies',
    subtitle:
      'Real-world examples of how construction teams use photo documentation to protect their work.',
    empty: 'No case studies yet.',
  },
  mk: {
    title: 'Студии на случај',
    subtitle:
      'Реални примери како градежните тимови користат фото документација за да ја заштитат својата работа.',
    empty: 'Сè уште нема студии на случај.',
  },
  sl: {
    title: 'Študije primerov',
    subtitle:
      'Resnični primeri, kako gradbene ekipe uporabljajo foto dokumentacijo za zaščito svojega dela.',
    empty: 'Še ni študij primerov.',
  },
  sr: {
    title: 'Studije slučaja',
    subtitle:
      'Realni primeri kako građevinski timovi koriste foto dokumentaciju da zaštite svoj rad.',
    empty: 'Još nema studija slučaja.',
  },
  de: {
    title: 'Fallstudien',
    subtitle:
      'Praxisbeispiele, wie Bauteams Fotodokumentation nutzen, um ihre Arbeit abzusichern.',
    empty: 'Noch keine Fallstudien.',
  },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const content = CONTENT[locale] ?? CONTENT.en

  return {
    title: `${content.title} | ${t('siteName')}`,
    description: content.subtitle,
  }
}

export default async function CaseStudiesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const common = await getTranslations({ locale, namespace: 'common' })
  const blog = await getTranslations({ locale, namespace: 'blog' })
  const content = CONTENT[locale] ?? CONTENT.en
  const posts = getAllPosts().filter((post) => post.type === 'case-study')

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 animate-fade-in-up sm:py-16">
      {/* Back link */}
      <div className="mb-8">
        <BackButton href="/" label={common('backHome')} />
      </div>

      {/* Header */}
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {content.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{content.subtitle}</p>
      </div>

      {posts.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {content.empty}
        </p>
      )}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <article key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5"
            >
              <Image
                src={`https://picsum.photos/seed/${post.slug}/800/450`}
                alt={post.title}
                width={800}
                height={450}
                className="mb-5 h-auto w-full rounded-xl object-cover"
              />
              <time
                dateTime={post.date}
                className="text-sm text-muted-foreground"
              >
                {formatDate(post.date)}
              </time>
              <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors duration-200 ease-premium group-hover:text-accent">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {post.description}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-accent">
                {blog('readMore')}
                <svg
                  className="size-4 transition-transform duration-200 ease-premium group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
