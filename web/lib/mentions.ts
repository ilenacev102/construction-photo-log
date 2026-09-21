/**
 * Extract @mentions from comment text.
 * Matches @ followed by a name. A mention is a single word (letters, digits,
 * hyphens, Macedonian chars) optionally followed by ONE space-separated word
 * whose first letter is uppercase Latin or Cyrillic — this supports full names
 * like "John Smith" while stopping before trailing lowercase words like "check".
 *
 * Example: "@John Smith check this @Jane-Doe" → ["John Smith", "Jane-Doe"]
 */
export function extractMentions(text: string): string[] {
  if (!text || typeof text !== 'string') return []

  const mentionPattern = /@([\w\u0400-\u04FF\u0500-\u052F-]+(?:[\s]+[A-Z\u0400-\u042F][\w\u0400-\u04FF\u0500-\u052F-]+)?)/g

  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = mentionPattern.exec(text)) !== null) {
    const name = match[1].trim()
    if (name && !matches.includes(name)) {
      matches.push(name)
    }
  }
  return matches
}

/**
 * Highlight mentions in text by wrapping them in a span.
 * Used for rendering comments with visual mention highlights.
 */
export function highlightMentions(text: string): string {
  if (!text || typeof text !== 'string') return text ?? ''

  return text.replace(
    /@([\w\u0400-\u04FF\u0500-\u052F-]+(?:[\s]+[A-Z\u0400-\u042F][\w\u0400-\u04FF\u0500-\u052F-]+)?)/g,
    '<span class="mention">@$1</span>'
  )
}
