import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Clock, Mail, MessageCircle, Plus, Trash2, UserPlus } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { normalizeUrl } from '../../lib/embeds'
import { pageUrl } from '../../lib/config'
import { Alert, Badge, Button, Card, Empty, Input, Modal, Select, Spinner, Stats, Textarea, Toggle, useToast, askConfirm } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const TRIGGERS = {
  comment: { label: 'Comment on a post or Reel', hint: 'Someone comments a keyword → they get a DM' },
  story_reply: { label: 'Reply to your story', hint: 'Someone replies to your story → they get a DM' },
  dm_keyword: { label: 'DM with a keyword', hint: 'Someone DMs you a keyword → instant reply' },
}

const DEFAULT_FOLLOW_PROMPT = 'Follow me and reply DONE to get the link 🙌'
const DEFAULT_COLLECT_PROMPT = {
  email: 'Reply with your email and I’ll send it there too 📩',
  phone: 'Reply with your WhatsApp number and I’ll send it there too 📲',
}
const DEFAULT_COLLECT_THANKS = 'Got it, thank you! 🙏'

const EVENT_LABELS = {
  comment: 'Comment',
  story_reply: 'Story reply',
  dm: 'DM',
  follow_prompt: 'Follow reminder',
  unlocked: 'Unlocked after follow',
  lead: 'Lead collected',
}

const BLANK = {
  name: '', trigger: 'comment', keywords: [], media_id: '', comment_reply: '', message: '', button_url: '', button_title: '', is_active: true,
  page_id: '', require_follow: false, follow_prompt: '', collect: '', collect_prompt: '', collect_thanks: '', follow_up_message: '', follow_up_minutes: 60,
}

const TEMPLATES = [
  {
    icon: UserPlus,
    title: 'Comment GUIDE → follow → DM link',
    text: 'Only followers get the link. Grows followers and DMs together.',
    rule: {
      name: 'Comment GUIDE → follow → DM', trigger: 'comment', keywords: ['guide'], comment_reply: 'Sent! Check your DMs 📩',
      require_follow: true, follow_prompt: DEFAULT_FOLLOW_PROMPT, message: 'Thanks for following! Here’s the guide you asked for 👇', button_title: 'Get the guide',
    },
  },
  {
    icon: Mail,
    title: 'Story reply → collect email',
    text: 'Reply to story replies with your link, then ask for their email.',
    rule: {
      name: 'Story reply → email', trigger: 'story_reply', keywords: [], message: 'Thanks for the reply! Here’s the link 👇', button_title: 'Open link',
      collect: 'email', collect_prompt: DEFAULT_COLLECT_PROMPT.email, collect_thanks: 'Got it! Watch your inbox 📬',
      follow_up_message: 'Did you get a chance to check it out? Reply here if you have any questions 🙂', follow_up_minutes: 120,
    },
  },
  {
    icon: MessageCircle,
    title: 'Comment GUIDE → DM',
    text: 'The classic: comment a keyword, get the link instantly.',
    rule: { name: 'Comment GUIDE → DM', trigger: 'comment', keywords: ['guide'], comment_reply: 'Sent! Check your DMs 📩', message: 'Hey! Here’s the guide you asked for 👇', button_title: 'Get the guide' },
  },
]

function fmtTime(d) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function fmtDelay(min) {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

function Section({ title, children }) {
  return (
    <div className="grid gap-4 rounded-3xl border border-ink/10 p-4 sm:p-5">
      {title && <p className="eyebrow text-ink-500">{title}</p>}
      {children}
    </div>
  )
}

function RuleModal({ rule, onClose, onSaved }) {
  const toast = useToast()
  const { page, pages } = usePage()
  const { user } = useAuth()
  const [r, setR] = useState(rule)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setR((x) => ({ ...x, ...patch }))
  const hasFollowUp = Boolean(r.follow_up_message?.trim())
  const minutes = Number(r.follow_up_minutes)

  async function save() {
    if (r.trigger === 'dm_keyword' && !r.keywords.length) return toast('DM rules need at least one keyword', 'error')
    if (hasFollowUp && !(minutes >= 5 && minutes <= 1380)) return toast('Follow-up delay must be between 5 and 1380 minutes', 'error')
    setBusy(true)
    const payload = {
      owner_id: user.id, name: r.name, trigger: r.trigger, keywords: r.keywords, media_id: r.media_id || null,
      comment_reply: r.trigger === 'comment' ? r.comment_reply || null : null, message: r.message,
      button_title: r.button_url ? r.button_title || 'Open link' : null, button_url: r.button_url ? normalizeUrl(r.button_url) : null,
      is_active: r.is_active,
      page_id: r.page_id || null,
      require_follow: r.require_follow,
      follow_prompt: r.require_follow ? r.follow_prompt?.trim() || null : null,
      collect: r.collect || null,
      collect_prompt: r.collect ? r.collect_prompt?.trim() || null : null,
      collect_thanks: r.collect ? r.collect_thanks?.trim() || null : null,
      follow_up_message: hasFollowUp ? r.follow_up_message.trim() : null,
      follow_up_minutes: hasFollowUp ? Math.round(minutes) : null,
    }
    const q = r.id ? supabase.from('dm_rules').update(payload).eq('id', r.id) : supabase.from('dm_rules').insert(payload)
    const { data, error } = await q.select().single()
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast('Automation saved')
    onSaved(data)
  }

  return (
    <Modal open onClose={onClose} title={r.id ? 'Edit automation' : 'New automation'} wide>
      <div className="grid gap-4">
        <Input label="Name (only you see this)" maxLength={80} placeholder="Free guide for comment “GUIDE”" value={r.name} onChange={(e) => set({ name: e.target.value })} />
        <Select label="When" value={r.trigger} onChange={(e) => set({ trigger: e.target.value })} options={Object.entries(TRIGGERS).map(([value, t]) => ({ value, label: t.label }))} hint={TRIGGERS[r.trigger].hint} />
        <Input
          label={r.trigger === 'dm_keyword' ? 'Keywords (required)' : 'Keywords (leave empty for any)'}
          placeholder="guide, link, price"
          value={r.keywords.join(', ')}
          onChange={(e) => set({ keywords: e.target.value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 10) })}
          hint="Comma separated. Matching ignores upper/lower case."
        />
        {r.trigger === 'comment' && (
          <>
            <Input label="Only for this post ID (optional)" placeholder="Leave empty for all posts & Reels" value={r.media_id || ''} onChange={(e) => set({ media_id: e.target.value.trim() })} />
            <Input label="Public reply to the comment (optional)" maxLength={300} placeholder="Sent! Check your DMs 📩" value={r.comment_reply || ''} onChange={(e) => set({ comment_reply: e.target.value })} />
          </>
        )}

        <Section title="Follow to unlock">
          <Toggle
            label="Ask them to follow first"
            description="We check they follow you before sending the message. Up to 3 reminders."
            checked={r.require_follow}
            onChange={(require_follow) => set({ require_follow, follow_prompt: require_follow && !r.follow_prompt ? DEFAULT_FOLLOW_PROMPT : r.follow_prompt })}
          />
          {r.require_follow && (
            <Textarea label="Follow request" rows={2} maxLength={500} placeholder={DEFAULT_FOLLOW_PROMPT} value={r.follow_prompt || ''} onChange={(e) => set({ follow_prompt: e.target.value })} hint="Tell them to reply (e.g. DONE) after following — their reply is when we check." />
          )}
        </Section>

        <Textarea label="DM message" rows={4} maxLength={1000} placeholder="Hey! Here’s the free guide you asked for 👇" value={r.message} onChange={(e) => set({ message: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Input label="Link (optional)" inputMode="url" placeholder={pageUrl(page.username)} value={r.button_url || ''} onChange={(e) => set({ button_url: e.target.value })} />
          <Input label="Button text" maxLength={20} placeholder="Open link" value={r.button_title || ''} onChange={(e) => set({ button_title: e.target.value })} />
        </div>

        <Section title="Collect leads">
          <Select
            label="After the message, ask for"
            value={r.collect || ''}
            onChange={(e) => set({ collect: e.target.value, collect_prompt: r.collect_prompt || '' })}
            options={[{ value: '', label: 'Nothing' }, { value: 'email', label: 'Their email' }, { value: 'phone', label: 'Their phone / WhatsApp number' }]}
          />
          {r.collect && (
            <>
              <Input label="Question" maxLength={300} placeholder={DEFAULT_COLLECT_PROMPT[r.collect]} value={r.collect_prompt || ''} onChange={(e) => set({ collect_prompt: e.target.value })} />
              <Input label="Thank-you reply" maxLength={300} placeholder={DEFAULT_COLLECT_THANKS} value={r.collect_thanks || ''} onChange={(e) => set({ collect_thanks: e.target.value })} />
              {pages.length > 0 && (
                <Select
                  label="Save leads to"
                  value={r.page_id || ''}
                  onChange={(e) => set({ page_id: e.target.value })}
                  options={[
                    { value: '', label: 'My first page' },
                    ...pages.map((p) => ({ value: p.id, label: `${p.display_name || p.username} (@${p.username})` })),
                  ]}
                  hint="They appear in Leads and Audience. Indian numbers are saved with +91."
                />
              )}
            </>
          )}
        </Section>

        <Section title="Follow-up">
          <Textarea label="Follow-up message (optional)" rows={2} maxLength={1000} placeholder="Did you get a chance to check it out? 🙂" value={r.follow_up_message || ''} onChange={(e) => set({ follow_up_message: e.target.value })} />
          {hasFollowUp && (
            <Input
              label="Send after (minutes)"
              type="number"
              min={5}
              max={1380}
              step={5}
              value={r.follow_up_minutes ?? ''}
              onChange={(e) => set({ follow_up_minutes: e.target.value === '' ? '' : Number(e.target.value) })}
              hint={`${minutes >= 5 && minutes <= 1380 ? `${fmtDelay(minutes)} later. ` : 'Between 5 and 1380 minutes. '}Instagram only allows messages within 24 hours of the person’s last message, so follow-ups go only to people who messaged you (story replies, DMs, or replies to the follow request).`}
            />
          )}
        </Section>

        <Toggle label="Active" checked={r.is_active} onChange={(is_active) => set({ is_active })} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={busy} disabled={!r.message.trim()}>Save</Button>
      </div>
    </Modal>
  )
}

const DAY_MS = 24 * 3600_000

function EventRow({ e, now }) {
  const recent = now - new Date(e.created_at).getTime() < DAY_MS
  return (
    <li className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={e.status === 'sent' ? 'green' : e.status === 'failed' ? 'red' : 'neutral'}>{e.status}</Badge>
        {e.awaiting && recent && (
          <Badge tone="lilac">{e.awaiting === 'follow' ? 'Waiting for follow' : 'Waiting for reply'}</Badge>
        )}
        {e.follow_up_at && (
          <Badge tone={e.follow_up_sent ? 'lime' : 'neutral'}>
            <Clock className="size-3" />
            {e.follow_up_sent ? 'Follow-up sent' : `Follow-up ${fmtTime(e.follow_up_at)}`}
          </Badge>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate">
        {EVENT_LABELS[e.event] || e.event.replace('_', ' ')} {e.ig_username && `from @${e.ig_username}`}
        {e.error && <span className={e.status === 'failed' ? 'text-red-600' : 'text-ink-500'}> — {e.error}</span>}
      </span>
      <span className="text-xs text-ink-400">{fmtTime(e.created_at)}</span>
    </li>
  )
}

export default function Automations() {
  const { instagram, page } = usePage()
  const { user } = useAuth()
  const toast = useToast()
  const [rules, setRules] = useState(null)
  const [events, setEvents] = useState([])
  const [editing, setEditing] = useState(null)
  const [now, setNow] = useState(0)
  const [view, setView] = useViewMode('automations')
  const [eventsView, setEventsView] = useViewMode('dm-activity')

  const load = useCallback(async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('dm_rules').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('dm_events').select('*').eq('owner_id', user.id).neq('event', 'pending').order('created_at', { ascending: false }).limit(30),
    ])
    setRules(r || [])
    setEvents(e || [])
    setNow(Date.now())
  }, [user.id])
  useEffect(() => {
    load()
  }, [load])

  async function toggle(rule, is_active) {
    setRules((list) => list.map((x) => (x.id === rule.id ? { ...x, is_active } : x)))
    const { error } = await supabase.from('dm_rules').update({ is_active }).eq('id', rule.id)
    if (error) toast(error.message, 'error')
  }
  async function remove(rule) {
    if (!(await askConfirm({ title: 'Delete this automation?', confirmLabel: 'Delete' }))) return
    await supabase.from('dm_rules').delete().eq('id', rule.id)
    setRules((list) => list.filter((x) => x.id !== rule.id))
  }

  const blank = { ...BLANK, page_id: page?.id || '' }
  const edit = (r) =>
    setEditing({
      ...BLANK, ...r,
      keywords: r.keywords || [], page_id: r.page_id || '', collect: r.collect || '',
      follow_up_minutes: r.follow_up_minutes ?? BLANK.follow_up_minutes,
    })
  const sent = events.filter((e) => e.status === 'sent').length
  const waiting = events.filter((e) => e.awaiting && now - new Date(e.created_at).getTime() < DAY_MS).length

  const templates = instagram && (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {TEMPLATES.map((t) => (
        <button
          key={t.title}
          type="button"
          onClick={() => setEditing({ ...blank, ...t.rule })}
          className="flex items-start gap-3 rounded-3xl bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime"><t.icon className="size-[18px]" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t.title}</span>
            <span className="mt-0.5 block text-xs text-ink-500">{t.text}</span>
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeading title="DM automation." italic="Reply while you sleep." actions={<Button onClick={() => setEditing(blank)} disabled={!instagram}><Plus className="size-4" /> New automation</Button>}>
        Send a DM automatically when someone comments a keyword, replies to your story or messages you.
      </PageHeading>

      {!instagram ? (
        <Alert tone="info">
          Connect Instagram first in <Link to="/dashboard/settings" className="font-semibold underline">Settings</Link>. Automation needs a Creator or Business account and the app’s messaging permission.
        </Alert>
      ) : (
        <Alert tone="info">
          Follows Instagram’s rules: one private reply per comment, and DMs only within 24 hours of the person’s message. If you connected before automations existed, reconnect Instagram to grant messaging access.
        </Alert>
      )}

      <Stats
        items={[
          ['Active automations', (rules || []).filter((r) => r.is_active).length, 'bg-white'],
          ['DMs sent (recent)', sent, 'bg-lime'],
          ['Waiting for reply', waiting, 'bg-lilac-100'],
          ['Total sent', (rules || []).reduce((s, r) => s + r.sent_count, 0), 'bg-ink text-white'],
        ]}
      />

      {rules === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : rules.length === 0 ? (
        <>
          <Empty icon={Bot} title="No automations yet">
            Classic: “Comment GUIDE and I’ll DM you the link” — the most effective way to grow DMs and leads. Start from a template:
          </Empty>
          {templates}
        </>
      ) : (
        <>
          <ViewToggle value={view} onChange={setView} />
          {view === 'table' ? (
            <DataTable
              rows={rules}
              minWidth={760}
              onRowClick={edit}
              columns={[
                { key: 'name', label: 'Name', value: (r) => r.name || TRIGGERS[r.trigger].label, className: 'truncate' },
                { key: 'trigger', label: 'When', value: (r) => TRIGGERS[r.trigger].label, className: 'text-ink-600' },
                { key: 'keywords', label: 'Keywords', value: (r) => r.keywords.join(', '), className: 'max-w-48 truncate text-ink-600', render: (r) => r.keywords.join(', ') || 'Any' },
                { key: 'sent_count', label: 'Sent', align: 'right', value: (r) => r.sent_count },
                { key: 'is_active', label: 'On', value: (r) => (r.is_active ? 1 : 0), render: (r) => <Toggle checked={r.is_active} onChange={(v) => toggle(r, v)} /> },
                { key: 'actions', label: '', align: 'right', render: (r) => <button type="button" onClick={() => remove(r)} className="ml-auto grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="size-4" /></button> },
              ]}
            />
          ) : (
          <div className="grid gap-2.5">
            {rules.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lilac-100"><MessageCircle className="size-5" /></span>
                <button type="button" onClick={() => edit(r)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{r.name || TRIGGERS[r.trigger].label}</p>
                  <p className="truncate text-sm text-ink-500">
                    {TRIGGERS[r.trigger].label}{r.keywords.length ? ` · “${r.keywords.join('”, “')}”` : ' · any'} · {r.sent_count} sent
                  </p>
                  {(r.require_follow || r.collect || r.follow_up_message) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.require_follow && <Badge tone="lilac">Follow to unlock</Badge>}
                      {r.collect && <Badge tone="lilac">Collects {r.collect === 'email' ? 'email' : 'phone'}</Badge>}
                      {r.follow_up_message && <Badge tone="lilac">Follow-up after {fmtDelay(r.follow_up_minutes)}</Badge>}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <Toggle checked={r.is_active} onChange={(v) => toggle(r, v)} />
                  <button type="button" onClick={() => remove(r)} className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="size-4" /></button>
                </div>
              </Card>
            ))}
          </div>
          )}
          {instagram && (
            <div>
              <p className="eyebrow mb-2.5 px-1 text-ink-500">Templates</p>
              {templates}
            </div>
          )}
        </>
      )}

      {events.length > 0 && (
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-ink-500">Recent activity</p>
            <ViewToggle value={eventsView} onChange={setEventsView} />
          </div>
          {eventsView === 'table' ? (
            <div className="mt-3">
              <DataTable
                bare
                rows={events}
                minWidth={620}
                defaultSort={{ key: 'created_at', dir: -1 }}
                columns={[
                  { key: 'event', label: 'Event', value: (e) => EVENT_LABELS[e.event] || e.event.replace('_', ' ') },
                  { key: 'ig_username', label: 'From', value: (e) => e.ig_username, className: 'text-ink-600', render: (e) => (e.ig_username ? `@${e.ig_username}` : '—') },
                  { key: 'status', label: 'Status', value: (e) => e.status, render: (e) => <Badge tone={e.status === 'sent' ? 'green' : e.status === 'failed' ? 'red' : 'neutral'}>{e.status}</Badge> },
                  { key: 'created_at', label: 'When', value: (e) => e.created_at, className: 'whitespace-nowrap text-ink-500', render: (e) => fmtTime(e.created_at) },
                ]}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-ink/5 text-sm">
              {events.map((e) => <EventRow key={e.id} e={e} now={now} />)}
            </ul>
          )}
        </Card>
      )}

      {editing && <RuleModal rule={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}
