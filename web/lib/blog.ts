import fs from 'fs'
import path from 'path'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPost {
  slug: string
  title: string
  date: string
  description: string
  type: 'post' | 'case-study'
  content: string
}

/** Parse YAML frontmatter from a markdown file. Returns { frontmatter, body }. */
function parseFrontmatter(
  raw: string,
): { frontmatter: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const yamlBlock = match[1]
  const body = match[2]

  const frontmatter: Record<string, string> = {}
  for (const line of yamlBlock.split('\n')) {
    const sepIndex = line.indexOf(':')
    if (sepIndex === -1) continue
    const key = line.slice(0, sepIndex).trim()
    let value = line.slice(sepIndex + 1).trim()
    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    frontmatter[key] = value
  }

  return { frontmatter, body }
}

/** Convert simple markdown to HTML. Covers the patterns used in blog posts. */
function markdownToHtml(md: string): string {
  let html = md

  // Escape HTML entities
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Horizontal rules
  html = html.replace(/^---\s*$/gm, '<hr class="my-8 border-border" />')

  // Tables
  html = html.replace(
    /^\|(.+)\|\s*$/gm,
    (_, row) => {
      const cells = row.split('|').map((c: string) => c.trim())
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    },
  )
  html = html.replace(
    /<tr>\s*<td>(?:-+\s*\|?\s*)+\s*<\/tr>/g,
    '<tr class="border-b border-border"><th></th></tr>',
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline underline-offset-2 hover:no-underline">$1</a>',
  )

  // Headings (h2, h3)
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-8 mb-3 text-lg font-semibold">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-10 mb-4 text-xl font-bold tracking-tight">$1</h2>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-muted-foreground">$1</li>')
  html = html.replace(
    /(<li[\s\S]*?<\/li>)\s*\n(?!\s*- )/g,
    (match) => `<ul class="space-y-1 my-3">${match}</ul>`,
  )

  // Paragraphs — wrap remaining text lines
  const lines = html.split('\n')
  const result: string[] = []
  let inList = false
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      continue
    }

    // Skip lines that are already wrapped in HTML tags
    if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<tr')) {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      result.push(trimmed)
      continue
    }

    if (trimmed.startsWith('<li')) {
      result.push(trimmed)
      inList = true
      continue
    }

    if (trimmed.startsWith('<td>') || trimmed.startsWith('<th>')) {
      if (!inTable) {
        result.push('<table class="w-full my-6 text-sm">')
        inTable = true
      }
      result.push(trimmed)
      continue
    }

    if (inList) {
      result.push('</ul>')
      inList = false
    }
    if (inTable) {
      result.push('</table>')
      inTable = false
    }

    result.push(`<p class="mb-4 leading-relaxed text-muted-foreground">${trimmed}</p>`)
  }

  if (inList) result.push('</ul>')
  if (inTable) result.push('</table>')

  return result.join('\n')
}

/** Get all blog posts, sorted by date descending. */
export function getAllPosts(): BlogPost[] {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))

  const posts: BlogPost[] = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
    const { frontmatter, body } = parseFrontmatter(raw)
    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || '',
      description: frontmatter.description || '',
      type: frontmatter.type === 'case-study' ? 'case-study' : 'post',
      content: markdownToHtml(body),
    }
  })

  // Sort by date descending (newest first)
  posts.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  return posts
}

/** Get a single blog post by slug. Returns null if not found. */
export function getPost(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(raw)

  return {
    slug,
    title: frontmatter.title || slug,
    date: frontmatter.date || '',
    description: frontmatter.description || '',
    type: frontmatter.type === 'case-study' ? 'case-study' : 'post',
    content: markdownToHtml(body),
  }
}

/** Get all blog post slugs. */
export function getAllSlugs(): string[] {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
}