'use client'

import { useRouter } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  href: string
  label?: string
}

export default function BackButton({ href, label }: BackButtonProps) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(href)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="group -m-1.5 inline-flex items-center gap-1.5 rounded-sm border border-transparent p-1.5 text-sm text-muted-foreground transition-all duration-180 ease-apple-spring hover:border-border hover:text-accent"
    >
      <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </button>
  )
}
