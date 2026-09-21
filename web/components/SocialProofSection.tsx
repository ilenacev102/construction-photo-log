import { useTranslations } from 'next-intl'
import { Camera, MapPin, FileText, Users, type LucideIcon } from 'lucide-react'

const capabilities: { icon: LucideIcon; titleKey: string }[] = [
  { icon: Camera, titleKey: 'autoDate.title' },
  { icon: MapPin, titleKey: 'gps.title' },
  { icon: FileText, titleKey: 'pdf.title' },
  { icon: Users, titleKey: 'team.title' },
]

/**
 * Landing capabilities band — a slim strip of the four core features,
 * reusing the localized feature titles. No invented testimonials.
 */
export default function SocialProofSection() {
  const t = useTranslations('features')
  const sp = useTranslations('socialProof')

  return (
    <section aria-label={sp('label')} className="bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <ul className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, titleKey }) => (
            <li key={titleKey} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(titleKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}