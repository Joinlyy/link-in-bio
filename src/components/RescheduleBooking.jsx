import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatIst } from '../lib/slots'
import { Alert, Button, Modal, Spinner, useToast } from './ui'
import { SlotPicker } from './order/shared'

/**
 * The creator moves a booked session. Only times when none of their sessions already runs are offered,
 * and the buyer is emailed the new time with a calendar invite.
 */
export default function RescheduleBooking({ booking, product, onClose, onDone }) {
  const toast = useToast()
  const [booked, setBooked] = useState(null)
  const [slot, setSlot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!booking) return
    setSlot(null)
    setError('')
    supabase.from('bookings').select('starts_at').eq('page_id', booking.page_id).neq('status', 'cancelled').gt('starts_at', new Date().toISOString()).limit(1000)
      .then(({ data }) => setBooked((data || []).map((b) => b.starts_at)))
  }, [booking])

  async function confirm() {
    if (!slot) return setError('Pick a new time')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('creator_reschedule_booking', { p_booking_id: booking.id, p_slot: slot })
    setBusy(false)
    if (err) return setError(err.message)
    toast('Session moved. The buyer has been emailed the new time.')
    onDone?.()
    onClose()
  }

  return (
    <Modal open={Boolean(booking)} onClose={onClose} title="Reschedule this session">
      {booking && (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            {booking.buyer_name || booking.buyer_email} is booked for <b>{formatIst(booking.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} IST</b>.
            Pick a new time. Times when you already have another session are not shown.
          </p>
          {booked === null ? <div className="grid h-24 place-items-center"><Spinner /></div> : <SlotPicker data={product?.data} booked={booked} value={slot} onChange={setSlot} />}
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Keep as it is</Button>
            <Button loading={busy} disabled={!slot} onClick={confirm}>Move session and email buyer</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
