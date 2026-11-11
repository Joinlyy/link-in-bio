import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Spinner, useToast } from './ui'

/**
 * Live message thread between one creator and the super admin.
 * `as` is who is typing: 'creator' or 'admin'.
 */
export default function ChatThread({ creatorId, as, className = '', onActivity }) {
  const toast = useToast()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottom = useRef(null)

  useEffect(() => {
    let alive = true
    setMessages(null)
    supabase
      .from('support_messages')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at')
      .limit(500)
      .then(({ data }) => alive && setMessages(data || []))

    // Mark the other side's messages as read
    supabase
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('creator_id', creatorId)
      .eq('sender', as === 'admin' ? 'creator' : 'admin')
      .is('read_at', null)
      .then(() => onActivity?.())

    const channel = supabase
      .channel(`support-${creatorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `creator_id=eq.${creatorId}` }, (payload) => {
        setMessages((list) => (list && !list.some((m) => m.id === payload.new.id) ? [...list, payload.new] : list))
      })
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [creatorId, as, onActivity])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    const { data, error } = await supabase.from('support_messages').insert({ creator_id: creatorId, sender: as, body }).select().single()
    setSending(false)
    if (error) return toast(error.message, 'error')
    setText('')
    setMessages((list) => (list.some((m) => m.id === data.id) ? list : [...list, data]))
    onActivity?.()
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
        {messages === null ? (
          <div className="grid h-40 place-items-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500">
            {as === 'creator' ? 'Questions, feedback or a problem? Message the team — we usually reply within a day.' : 'No messages yet.'}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === as
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line ${mine ? 'rounded-br-lg bg-ink text-white' : 'rounded-bl-lg bg-cream'}`}>
                  {m.body}
                  <p className={`mt-1 text-[10px] ${mine ? 'text-white/50' : 'text-ink-400'}`}>
                    {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-ink/5 p-3">
        <textarea
          className="field max-h-40 min-h-12 flex-1 resize-none py-3"
          rows={1}
          maxLength={4000}
          placeholder="Write a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e)
          }}
        />
        <button type="submit" disabled={sending || !text.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" aria-label="Send">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}
