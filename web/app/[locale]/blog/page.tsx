import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { getAllPosts } from '@/lib/blog'
import BackButton from '@/components/BackButton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: t('blogTitle'),
    description: t('blogDesc'),
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Link label for the case-studies index. Lives here (not in
 * web/messages/*.json) because the i18n edit rule forbids adding keys —
 * the value is only ever shown as static chrome on this page.
 */
const CASE_STUDIES_LABEL: Record<string, string> = {
  en: 'Case studies',
  mk: 'Студии на случај',
  sl: 'Študije primerov',
  sr: 'Studije slučaja',
  de: 'Fallstudien',
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const posts = getAllPosts().filter((post) => post.type !== 'case-study')

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 animate-fade-in-up sm:py-16">
      {/* Back link */}
      <div className="mb-8">
        <BackButton href="/" label={common('backHome')} />
      </div>

      {/* Header */}
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-3 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {posts.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}

      {/* Featured post */}
      {posts.length > 0 && (
        <Link
          href={`/blog/${posts[0].slug}`}
          className="group mt-12 block rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 sm:p-8"
        >
          <Image
            src={`https://picsum.photos/seed/${posts[0].slug}/800/450`}
            alt={posts[0].title}
            width={800}
            height={450}
            className="mb-5 h-auto w-full rounded-xl object-cover"
          />
          <time dateTime={posts[0].date} className="text-sm text-muted-foreground">
            {formatDate(posts[0].date)}
          </time>
          <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-foreground transition-colors duration-200 ease-premium group-hover:text-accent sm:text-3xl">
            {posts[0].title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {posts[0].description}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            {t('readMore')}
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
      )}

      {/* Remaining posts */}
      {posts.length > 1 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {posts.slice(1).map((post) => (
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
                  {t('readMore')}
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
      )}

      {/* Link to case studies — content is aggregated on its own index */}
      <div className="mt-16 border-t border-border pt-8">
        <Link
          href="/case-studies"
          className="group flex flex-col gap-1"
        >
          <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            {CASE_STUDIES_LABEL[locale] ?? CASE_STUDIES_LABEL.en}
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
      </div>
    </div>
  )
}