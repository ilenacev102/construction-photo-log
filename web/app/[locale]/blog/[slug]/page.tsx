import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPost, getAllSlugs } from '@/lib/blog'
import BackButton from '@/components/BackButton'

interface Props {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const blog = await getTranslations({ locale, namespace: 'blog' })
  const post = getPost(slug)

  if (!post) {
    return { title: `${blog('notFoundTitle')} | ${t('siteName')}` }
  }

  return {
    title: `${post.title} | ${t('siteName')}`,
    description: post.description,
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export default async function BlogPostPage({ params }: Props) {
  const { slug, locale } = await params
  const blog = await getTranslations({ locale, namespace: 'blog' })
  const post = getPost(slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 animate-fade-in-up sm:py-16">
      {/* Back link */}
      <BackButton href="/blog" label={blog('back')} />

      {/* Post header */}
      <article className="mt-10">
        <header className="border-b border-border pb-8">
          <time
            dateTime={post.date}
            className="text-sm font-medium uppercase tracking-[0.12em] text-accent"
          >
            {formatDate(post.date)}
          </time>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {post.description}
          </p>
        </header>

        {/* Post content */}
        <div
          className="prose-custom mt-8"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  )
}