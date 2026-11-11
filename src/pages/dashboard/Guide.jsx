import { Check, X } from 'lucide-react'
import { Card } from '../../components/ui'
import { GUIDE } from '../../lib/help'
import { PageHeading } from './DashboardLayout'

const SECTIONS = [['how', 'How it works'], ['tabs', 'What each tab does'], ['terms', 'What things mean'], ['minimum', 'The minimum you need'], ['naming', 'Best names to use']]

function Title({ id, children, intro }) {
  return (
    <div id={id} className="scroll-mt-24 px-1 pt-4">
      <h2 className="font-display text-2xl font-bold tracking-tight">{children}</h2>
      {intro && <p className="mt-1 text-[15px] text-ink-500">{intro}</p>}
    </div>
  )
}

export default function Guide() {
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeading title="Guide." italic="Everything, explained.">
        How the app works, what each word means, what you need at minimum, and how to name things well.
      </PageHeading>

      <nav className="scrollbar-none flex gap-1.5 overflow-x-auto" aria-label="Guide sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="h-9 shrink-0 rounded-full bg-white px-4 text-sm leading-9 font-semibold text-ink-600 shadow-soft hover:text-ink">{label}</a>
        ))}
      </nav>

      <Title id="how" intro="From signing up to your first visitor, in six steps.">How it works</Title>
      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDE.how.map(([title, text], i) => (
          <Card key={title} className="flex gap-3 p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime text-sm font-bold">{i + 1}</span>
            <div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
            </div>
          </Card>
        ))}
      </div>

      <Title id="tabs" intro="Each thing has one home in your dashboard.">What each tab does</Title>
      <Card className="divide-y divide-ink/5">
        {GUIDE.tabs.map(([name, text]) => (
          <div key={name} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <p className="font-bold">{name}</p>
            <p className="text-sm text-ink-600">{text}</p>
          </div>
        ))}
      </Card>

      <Title id="terms" intro="Plain meanings for the words used in the app.">What things mean</Title>
      <Card className="divide-y divide-ink/5">
        {GUIDE.terms.map(([name, text]) => (
          <div key={name} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <p className="font-bold">{name}</p>
            <p className="text-sm text-ink-600">{text}</p>
          </div>
        ))}
      </Card>

      <Title id="minimum" intro="You don’t need all of this at once. Add only what you’ll use.">The minimum you need</Title>
      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDE.minimum.map((group) => (
          <Card key={group.title} className="p-5">
            <h3 className="font-bold">{group.title}</h3>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink-600"><Check className="mt-0.5 size-4 shrink-0 text-teal" /> {item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Title id="naming" intro="Clear names help visitors decide, and help you find things later.">Best names to use</Title>
      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDE.naming.map(([name, rule, good, bad]) => (
          <Card key={name} className="p-5">
            <h3 className="font-bold">{name}</h3>
            <p className="mt-1 text-sm text-ink-600">{rule}</p>
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold break-words"><Check className="mt-0.5 size-4 shrink-0 text-teal" /> <span className="min-w-0">{good}</span></p>
            <p className="mt-1 flex items-start gap-2 text-sm break-words text-ink-500"><X className="mt-0.5 size-4 shrink-0 text-red-600" /> <span className="min-w-0">{bad}</span></p>
          </Card>
        ))}
      </div>
    </div>
  )
}
