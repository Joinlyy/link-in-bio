import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ChatThread from '../../components/ChatThread'
import { Card, Empty, Spinner } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

export default function AdminMessages() {
  const [threads, setThreads] = useState(null)
  const [active, setActive] = useState(null)

  const load = useCallback(async () => {
    // Latest 1000 messages are enough to build the inbox; grouped client-side
    const { data } = await supabase
      .from('support_messages')
      .select('id, creator_id, sender, body, read_at, created_at, profiles!support_messages_creator_id_fkey(email, full_name, pages(username))')
      .order('created_at', { ascending: false })
      .limit(1000)
    const map = new Map()
    for (const m of data || []) {
      const t = map.get(m.creator_id) || { creator_id: m.creator_id, profile: m.profiles, last: m, unread: 0 }
      if (m.sender === 'creator' && !m.read_at) t.unread += 1
      map.set(m.creator_id, t)
    }
    setThreads([...map.values()])
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('admin-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const name = (t) => t.profile?.full_name || t.profile?.email || 'Creator'
  const username = (t) => (Array.isArray(t.profile?.pages) ? t.profile.pages[0] : t.profile?.pages)?.username

  return (
    <div className="space-y-4">
      <PageHeading title="Messages." italic="From creators." />
      {threads === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : threads.length === 0 ? (
        <Empty icon={MessagesSquare} title="No messages yet">Creators can message you from Dashboard → Messages.</Empty>
      ) : (
        <Card className="grid h-[min(700px,calc(100dvh-12rem))] overflow-hidden lg:grid-cols-[320px_1fr]">
          <div className={`min-h-0 overflow-y-auto border-ink/5 lg:border-r ${active ? 'hidden lg:block' : ''}`}>
            {threads.map((t) => (
              <button key={t.creator_id} type="button" onClick={() => setActive(t)} className={`flex w-full items-start gap-3 border-b border-ink/5 px-4 py-3.5 text-left hover:bg-cream ${active?.creator_id === t.creator_id ? 'bg-cream' : ''}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac-100 text-sm font-bold">{name(t)[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{name(t)}</span>
                    {t.unread > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-lime">{t.unread}</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{username(t) ? `/${username(t)} · ` : ''}{t.last.sender === 'admin' ? 'You: ' : ''}{t.last.body}</span>
                </span>
              </button>
            ))}
          </div>
          <div className={`min-h-0 flex-col ${active ? 'flex' : 'hidden lg:flex'}`}>
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-ink/5 px-4 py-3">
                  <button type="button" onClick={() => setActive(null)} className="grid size-9 place-items-center rounded-full bg-cream lg:hidden" aria-label="Back"><ArrowLeft className="size-4" /></button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{name(active)}</p>
                    <p className="truncate text-xs text-ink-500">{active.profile?.email}{username(active) && <> · <a className="underline" href={`/${username(active)}`} target="_blank" rel="noreferrer">/{username(active)}</a></>}</p>
                  </div>
                </div>
                <ChatThread key={active.creator_id} creatorId={active.creator_id} as="admin" className="min-h-0 flex-1" onActivity={load} />
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-sm text-ink-500">Pick a conversation</div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
