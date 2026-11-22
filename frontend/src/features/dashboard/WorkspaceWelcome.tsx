import type { ReactNode } from 'react'
import { CalendarDays, Cpu } from 'lucide-react'
import { site } from '../../config/site'

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  timeZone: site.timezone, weekday: 'long', month: 'long', day: 'numeric',
})

export function WorkspaceWelcome({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  const date = dateFormatter.format(new Date())

  return (
    <section className="workbench-welcome">
      <div className="workbench-intro">
        <time className="workbench-date">
          <CalendarDays size={16} aria-hidden="true" /> {date}
        </time>
        <h1 dir="auto">{title}</h1>
        <p>{description}</p>
        <div className="workbench-actions">{children}</div>
      </div>
      <div className="workbench-drawing" aria-hidden="true">
        <div className="workbench-scene">
          <div className="workbench-shadow" />
          <div className="workbench-phone">
            <div className="workbench-chassis" />
            <div className="workbench-board"><Cpu size={34} strokeWidth={1.4} /><i /><i /></div>
            <div className="workbench-glass"><i /></div>
          </div>
        </div>
      </div>
    </section>
  )
}
