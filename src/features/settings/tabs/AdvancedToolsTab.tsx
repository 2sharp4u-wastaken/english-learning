import { ExternalLink, ImageIcon, Sparkles } from 'lucide-react'
import { SectionCard } from '../components/SectionCard'

export function AdvancedToolsTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="כלי הורה מתקדמים"
        description="הכלים המתקדמים — ייבוא מילים דרך Claude וניהול תמונות/תרגומים — עדיין חיים בדף ההגדרות הישן. הם ימוזגו ל-React בסבב מאוחר יותר."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ToolLink
            href="settings.html"
            icon={<Sparkles size={20} />}
            title="הוספת מילים מותאמות"
            body="ייבוא מילים באנגלית ותרגום אוטומטי לעברית עם Claude. פותח בדף ההגדרות הישן."
          />
          <ToolLink
            href="settings.html"
            icon={<ImageIcon size={20} />}
            title="תמונות ותרגומים"
            body="החלפת תמונות ותרגומים למילים קיימות. פותח בדף ההגדרות הישן."
          />
        </div>
      </SectionCard>
    </div>
  )
}

interface ToolLinkProps {
  href: string
  icon: React.ReactNode
  title: string
  body: string
}

function ToolLink({ href, icon, title, body }: ToolLinkProps) {
  return (
    <a
      href={href}
      className="group flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20 hover:bg-white/8"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-text">
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <span>{title}</span>
          <ExternalLink size={13} className="text-muted transition-colors group-hover:text-text" />
        </div>
        <p className="text-xs text-muted">{body}</p>
      </div>
    </a>
  )
}
