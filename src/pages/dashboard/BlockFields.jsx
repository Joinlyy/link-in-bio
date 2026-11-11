import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { newCard } from './blockTypes'
import ImageInput from '../../components/ImageInput'
import { Button, Input, Select, Textarea, Toggle } from '../../components/ui'
import { usePage } from '../../context/PageContext'
import { instagramEmbed, isValidUrl, normalizeUrl, spotifyEmbed, youtubeId } from '../../lib/embeds'

const LINK_TOOLS = {
  form: [['Google Form', 'https://forms.new'], ['Tally form', 'https://tally.so']],
  booking: [['Calendly booking', 'https://calendly.com']],
  meeting: [['Google Meet', 'https://meet.new'], ['Zoom meeting', 'https://zoom.us/meeting/schedule']],
}

/** Free tools that create the link a button needs, opened in a new tab */
function LinkTools({ tools = ['form', 'booking', 'meeting'] }) {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
      <span>No link yet? Create one:</span>
      {tools.flatMap((key) => LINK_TOOLS[key]).map(([name, url]) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">{name}</a>
      ))}
    </p>
  )
}

/** A button can use the built-in form, or send people to the creator's own form */
function FormChoice({ d, set, builtIn }) {
  const action = d.action === 'link' ? 'link' : 'form'
  return (
    <div className="grid gap-3 sm:col-span-2">
      <Select
        label="When someone taps the button"
        value={action}
        onChange={(e) => set({ action: e.target.value })}
        options={[{ value: 'form', label: builtIn }, { value: 'link', label: 'Go to my own form or link' }]}
      />
      {action === 'link' && (
        <div>
          <UrlInput label="Your form or link" placeholder="https://forms.gle/…" value={d.url} onChange={(url) => set({ url })} hint={d.url ? undefined : 'Until you add a link, this keeps using the built-in form.'} />
          <LinkTools tools={['form', 'booking']} />
        </div>
      )}
    </div>
  )
}

function UrlInput({ value, onChange, label = 'URL', placeholder = 'https://', validate, hint }) {
  const v = value || ''
  const [checked, setChecked] = useState(false)
  const wrong = Boolean(v.trim()) && (validate ? !validate(normalizeUrl(v)) : !isValidUrl(v))
  // Half-typed links aren't mistakes: judge the link once she leaves the field or pastes it
  const error = checked && wrong ? (validate ? `This doesn’t look like a ${label.replace(/ URL| link/i, '').replace(/ or .*/, '')} link. Copy it from the app’s Share button.` : 'This doesn’t look like a link. It should look like instagram.com/yourname.') : ''
  return (
    <Input
      label={label}
      inputMode="url"
      placeholder={placeholder}
      value={v}
      error={error}
      hint={hint}
      onChange={(e) => {
        onChange(e.target.value)
        if (e.nativeEvent.inputType === 'insertFromPaste') setChecked(true)
      }}
      onBlur={() => {
        setChecked(true)
        if (v) onChange(normalizeUrl(v))
      }}
    />
  )
}

function ItemsEditor({ title, onTitle, items, onItems, empty, max, render }) {
  const update = (i, patch) => onItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="grid gap-4">
      <Input label="Section title" maxLength={80} value={title || ''} onChange={(e) => onTitle(e.target.value)} />
      {items.map((item, i) => (
        <div key={i} className="grid gap-3 rounded-2xl bg-cream p-4">
          {render(item, (patch) => update(i, patch))}
          <button type="button" onClick={() => onItems(items.filter((_, j) => j !== i))} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-red-600">
            <Trash2 className="size-3.5" /> Remove
          </button>
        </div>
      ))}
      {items.length < max && (
        <Button variant="soft" size="sm" className="w-fit" onClick={() => onItems([...items, empty])}>
          <Plus className="size-4" /> Add item
        </Button>
      )}
    </div>
  )
}

export const CARD_COLUMNS = [
  { value: '1', label: '1 in a row' },
  { value: '2', label: '2 in a row' },
  { value: '3', label: '3 in a row' },
  { value: '4', label: '4 in a row' },
  { value: 'swipe', label: 'Swipe sideways' },
]
export const CARD_STYLES = [
  { value: 'image', label: 'Picture on top' },
  { value: 'overlay', label: 'Text over picture' },
  { value: 'row', label: 'Small picture on side' },
  { value: 'plain', label: 'No picture' },
]
export const PRODUCT_LIMITS = [
  { value: '0', label: 'Show all' },
  { value: '3', label: 'First 3, then See all' },
  { value: '4', label: 'First 4, then See all' },
  { value: '6', label: 'First 6, then See all' },
]
const normalizeColumns = (v) => (v === 'swipe' ? 'swipe' : Number(v))

function SectionLayoutFields({ d, set }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select label="Cards in a row" value={String(d.columns || 2)} onChange={(e) => set({ columns: normalizeColumns(e.target.value) })} options={CARD_COLUMNS} />
      <Select label="Card style" value={d.style || 'image'} onChange={(e) => set({ style: e.target.value })} options={CARD_STYLES} />
    </div>
  )
}

function ProductsPicker({ d, set }) {
  return (
    <div className="grid gap-4">
      <Input label="Section name" maxLength={80} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
      <SectionLayoutFields d={d} set={set} />
      <Select label="How many" value={String(d.limit || 0)} onChange={(e) => set({ limit: Number(e.target.value) })} options={PRODUCT_LIMITS} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" to="/dashboard/products" state={{ newProduct: true }}><Plus className="size-4" /> Add a product</Button>
        <Button size="sm" variant="outline" to="/dashboard/products">Manage my products</Button>
      </div>
    </div>
  )
}

function CardEditor({ item, index, total, update, remove, move, products }) {
  const [open, setOpen] = useState(!item.title || item.title === 'New card')
  const sellable = products.filter((p) => p.is_published && p.type !== 'link')
  const action = item.action || 'details'
  return (
    <div className="rounded-2xl bg-cream">
      <div className="flex items-center gap-2 p-2">
        <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-white">
          {item.image ? <img src={item.image} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-lg" aria-hidden>{item.emoji || '✨'}</span>}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{item.title || 'Untitled card'}</button>
        <button type="button" onClick={() => move(-1)} disabled={index === 0} className="grid size-8 place-items-center rounded-full bg-white disabled:opacity-30" aria-label="Move earlier"><ArrowUp className="size-3.5" /></button>
        <button type="button" onClick={() => move(1)} disabled={index === total - 1} className="grid size-8 place-items-center rounded-full bg-white disabled:opacity-30" aria-label="Move later"><ArrowDown className="size-3.5" /></button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-8 place-items-center rounded-full bg-white" aria-label="Edit card" aria-expanded={open}><ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} /></button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-ink/5 p-3">
          <Input label="Card name" maxLength={80} value={item.title} onChange={(e) => update({ title: e.target.value })} />
          <Input label="Small text (optional)" maxLength={100} placeholder="One line about it" value={item.text || ''} onChange={(e) => update({ text: e.target.value })} />
          <ImageInput label="Picture" value={item.image} onChange={(image) => update({ image })} folder="cards" />
          <details className="rounded-2xl bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">More options</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-[100px_1fr]">
            <Input label="Emoji" maxLength={8} placeholder="⭐" value={item.emoji || ''} onChange={(e) => update({ emoji: e.target.value })} />
            <Input label="Price or label (optional)" maxLength={30} placeholder="₹499" value={item.price || ''} onChange={(e) => update({ price: e.target.value })} />
            </div>
          </details>
          <Select
            label="When someone taps it"
            value={action}
            onChange={(e) => update({ action: e.target.value })}
            options={[{ value: 'details', label: 'Open a details popup' }, { value: 'link', label: 'Go straight to a link' }, { value: 'product', label: 'Sell a product (popup with payment)' }]}
          />
          {action === 'details' && (
            <>
              <Textarea label="Details" rows={4} maxLength={2000} placeholder="What it is, who it’s for, what they get…" value={item.details || ''} onChange={(e) => update({ details: e.target.value })} />
              <div>
                <UrlInput label="Button link (optional)" value={item.url} onChange={(url) => update({ url })} />
                <LinkTools />
              </div>
              {item.url && <Input label="Button name" maxLength={30} placeholder="Continue" value={item.button || ''} onChange={(e) => update({ button: e.target.value })} />}
            </>
          )}
          {action === 'link' && (
            <div>
              <UrlInput label="Link" value={item.url} onChange={(url) => update({ url })} />
              <LinkTools />
            </div>
          )}
          {action === 'product' && (
            sellable.length ? (
              <Select label="Product" value={item.product_id || ''} onChange={(e) => update({ product_id: e.target.value })} options={[{ value: '', label: 'Choose a product…' }, ...sellable.map((p) => ({ value: p.id, label: p.title || 'Untitled' }))]} />
            ) : (
              <p className="rounded-2xl bg-white p-3 text-sm">Publish a product first. <Link to="/dashboard/products" className="font-semibold underline">Products</Link></p>
            )
          )}
          <button type="button" onClick={remove} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="size-3.5" /> Remove card</button>
        </div>
      )}
    </div>
  )
}

function CardsFields({ d, set }) {
  const { products } = usePage()
  const items = d.items || []
  const update = (i, patch) => set({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  const move = (i, dir) => {
    const next = [...items]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ items: next })
  }
  return (
    <div className="grid gap-4">
      <Input label="Section name" maxLength={80} placeholder="Services, Courses, My work…" value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
      <Input label="Section description (optional)" maxLength={160} value={d.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} />
      <SectionLayoutFields d={d} set={set} />
      <div className="grid gap-2">
        {items.map((item, i) => (
          <CardEditor key={item.id || i} item={item} index={i} total={items.length} products={products} update={(p) => update(i, p)} remove={() => set({ items: items.filter((_, j) => j !== i) })} move={(dir) => move(i, dir)} />
        ))}
      </div>
      {items.length < 24 && <Button variant="soft" size="sm" className="w-fit" onClick={() => set({ items: [...items, newCard()] })}><Plus className="size-4" /> Add a card</Button>}
    </div>
  )
}

function LinkTarget({ d, set }) {
  const { products } = usePage()
  const sellable = products.filter((p) => p.is_published && p.type !== 'link')
  return (
    <>
      <Select
        label="When someone taps it"
        value={d.product_id ? 'product' : 'link'}
        onChange={(e) => set({ product_id: e.target.value === 'product' ? sellable[0]?.id || '' : '' })}
        options={[{ value: 'link', label: 'Go to a link' }, { value: 'product', label: 'Sell a product (popup with payment)' }]}
      />
      {d.product_id !== undefined && d.product_id !== '' ? (
        <Select label="Product" value={d.product_id} onChange={(e) => set({ product_id: e.target.value })} options={sellable.map((p) => ({ value: p.id, label: p.title || 'Untitled' }))} />
      ) : (
        <div>
          <UrlInput value={d.url} onChange={(url) => set({ url })} />
          <LinkTools />
        </div>
      )}
    </>
  )
}

function LockedPicker({ d, set }) {
  const { products } = usePage()
  const sellable = products.filter((p) => p.is_published && ['content', 'digital', 'bundle', 'membership'].includes(p.type))
  return (
    <div className="grid gap-4">
      {sellable.length === 0 ? (
        <p className="rounded-2xl bg-lilac-100 p-4 text-sm">
          Create a <b>Paid content</b> product first — that’s where the hidden content lives. <Link to="/dashboard/products" className="font-semibold underline">Products</Link>
        </p>
      ) : (
        <Select
          label="Unlocks"
          value={d.product_id || ''}
          onChange={(e) => set({ product_id: e.target.value })}
          options={[{ value: '', label: 'Choose a product…' }, ...sellable.map((p) => ({ value: p.id, label: p.title || 'Untitled' }))]}
        />
      )}
      <Input label="Title (optional)" maxLength={80} placeholder="My full skincare routine" value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
      <Textarea label="Teaser" rows={2} maxLength={300} placeholder="The exact products, order and timings I use…" value={d.teaser || ''} onChange={(e) => set({ teaser: e.target.value })} />
      <Input label="Button label (optional)" maxLength={30} value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
    </div>
  )
}

/** Type-specific editing form for one block */
export default function BlockFields({ block, onChange }) {
  const d = block.data || {}
  const set = (patch) => onChange({ data: patch })

  switch (block.type) {
    case 'link':
      return (
        <div className="grid gap-4">
          <Input label="Title" value={d.title || ''} maxLength={100} placeholder="Watch my latest video" onChange={(e) => set({ title: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
            <Input label="Emoji" value={d.emoji || ''} maxLength={8} placeholder="⭐" onChange={(e) => set({ emoji: e.target.value })} />
            <Input label="Small text (optional)" value={d.subtitle || ''} maxLength={60} placeholder="₹299 · Instant PDF" onChange={(e) => set({ subtitle: e.target.value })} />
          </div>
          <LinkTarget d={d} set={set} />
          <ImageInput label="Thumbnail (optional)" round value={d.thumbnail} onChange={(thumbnail) => set({ thumbnail })} folder="thumbnails" />
          <Toggle label="Main button" description="Shown as the big button at the top of your site" checked={!!d.primary} onChange={(primary) => set({ primary })} />
          <Toggle label="Highlight" description="Gently animate this link to draw attention" checked={!!d.highlight} onChange={(highlight) => set({ highlight })} />
        </div>
      )
    case 'whatsapp':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Button type" value={d.mode || 'chat'} onChange={(e) => set({ mode: e.target.value })} options={[{ value: 'chat', label: 'WhatsApp chat' }, { value: 'call', label: 'Phone call' }]} />
          <Input label="Phone number" inputMode="tel" placeholder="98765 43210" value={d.phone || ''} onChange={(e) => set({ phone: e.target.value })} hint="Indian numbers get +91 automatically" />
          <Input className="sm:col-span-2" label="Button label (optional)" placeholder="Chat with me on WhatsApp" hint="Leave empty to show only the icon" maxLength={80} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          {d.mode !== 'call' && (
            <Textarea className="sm:col-span-2" rows={2} label="Pre-filled message (optional)" placeholder="Hi! I found you on Instagram…" maxLength={300} value={d.message || ''} onChange={(e) => set({ message: e.target.value })} />
          )}
        </div>
      )
    case 'webinar':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Webinar title" maxLength={120} placeholder="Live: Skincare basics for Indian skin" value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <Input label="Date" type="date" value={d.date || ''} onChange={(e) => set({ date: e.target.value })} />
          <Input label="Time (IST)" type="time" value={d.time || ''} onChange={(e) => set({ time: e.target.value })} />
          <div className="sm:col-span-2">
            <UrlInput label="Zoom registration link" placeholder="https://zoom.us/webinar/register/…" value={d.url} onChange={(url) => set({ url })} hint="Create the webinar in your own Zoom account and paste its registration link." />
            <LinkTools tools={["meeting"]} />
          </div>
          <Textarea className="sm:col-span-2" rows={2} label="Short description (optional)" maxLength={300} value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
          <Input label="Button label (optional)" placeholder="Register free" maxLength={40} value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
        </div>
      )
    case 'youtube':
      return (
        <div className="grid gap-4">
          <UrlInput label="YouTube video URL" placeholder="https://youtu.be/…" value={d.url} validate={(u) => !!youtubeId(u)} onChange={(url) => set({ url })} />
          <Input label="Caption (optional)" maxLength={100} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
        </div>
      )
    case 'instagram':
      return <UrlInput label="Instagram Reel or post URL" placeholder="https://www.instagram.com/reel/…" value={d.url} validate={(u) => !!instagramEmbed(u)} onChange={(url) => set({ url })} hint="Only public posts can be embedded." />
    case 'spotify':
      return <UrlInput label="Spotify link" placeholder="https://open.spotify.com/track/…" value={d.url} validate={(u) => !!spotifyEmbed(u)} onChange={(url) => set({ url })} />
    case 'lead_form':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Title" maxLength={80} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <Textarea className="sm:col-span-2" rows={2} label="Description (optional)" maxLength={200} value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
          <FormChoice d={d} set={set} builtIn="Show the sign-up form here" />
          {d.action !== 'link' && <Select
            label="Collect"
            value={d.collect || 'email'}
            onChange={(e) => set({ collect: e.target.value })}
            options={[
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'WhatsApp number' },
              { value: 'both', label: 'Email + WhatsApp' },
            ]}
          />}
          <Input label="Button label (optional)" placeholder="Subscribe" maxLength={30} value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
          <div className="sm:col-span-2">
            <Toggle label="Open as a popup after 10 seconds" description="Also opens on Home for each visit. If it’s closed, it stays closed until the visitor refreshes or comes back." checked={Boolean(d.popup)} onChange={(popup) => set({ popup })} />
          </div>
          <p className="text-xs leading-relaxed text-ink-500 sm:col-span-2">
            Visitors must tick a consent checkbox before submitting. The exact consent text is saved with every lead.
          </p>
        </div>
      )
    case 'image':
      return (
        <div className="grid gap-4">
          <ImageInput value={d.image} onChange={(image) => set({ image })} folder="images" />
          <Input label="Alt text" placeholder="Describe the image" maxLength={120} value={d.alt || ''} onChange={(e) => set({ alt: e.target.value })} />
          <UrlInput label="Link when tapped (optional)" value={d.url} onChange={(url) => set({ url })} />
        </div>
      )
    case 'heading':
      return <Input label="Heading" maxLength={80} value={d.text || ''} onChange={(e) => set({ text: e.target.value })} />
    case 'text':
      return (
        <div className="grid gap-4">
          <Textarea label="Text" rows={3} maxLength={600} value={d.text || ''} onChange={(e) => set({ text: e.target.value })} />
          <Select label="Alignment" value={d.align || 'center'} onChange={(e) => set({ align: e.target.value })} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />
        </div>
      )
    case 'countdown':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Title" maxLength={80} placeholder="New collection drops in" value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <Input label="Ends at (IST)" type="datetime-local" value={d.target || ''} onChange={(e) => set({ target: e.target.value })} />
          <Input label="Text after it ends" maxLength={60} placeholder="It’s live!" value={d.ended_text || ''} onChange={(e) => set({ ended_text: e.target.value })} />
          <div className="sm:col-span-2">
            <UrlInput label="Button link (optional)" value={d.url} onChange={(url) => set({ url })} />
            <LinkTools />
          </div>
          <Input label="Button label" maxLength={30} placeholder="Set a reminder" value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
        </div>
      )
    case 'faq':
      return (
        <ItemsEditor
          title={d.title}
          onTitle={(title) => set({ title })}
          items={d.items || []}
          onItems={(items) => set({ items })}
          empty={{ q: '', a: '' }}
          max={15}
          render={(item, update) => (
            <>
              <Input label="Question" maxLength={150} value={item.q} onChange={(e) => update({ q: e.target.value })} />
              <Textarea label="Answer" rows={2} maxLength={800} value={item.a} onChange={(e) => update({ a: e.target.value })} />
            </>
          )}
        />
      )
    case 'testimonials':
      return (
        <ItemsEditor
          title={d.title}
          onTitle={(title) => set({ title })}
          items={d.items || []}
          onItems={(items) => set({ items })}
          empty={{ quote: '', name: '', role: '' }}
          max={10}
          render={(item, update) => (
            <>
              <Textarea label="Quote" rows={2} maxLength={400} value={item.quote} onChange={(e) => update({ quote: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Name" maxLength={60} value={item.name} onChange={(e) => update({ name: e.target.value })} />
                <Input label="Role / brand" maxLength={60} value={item.role} onChange={(e) => update({ role: e.target.value })} />
              </div>
            </>
          )}
        />
      )
    case 'enquiry':
      return (
        <div className="grid gap-4">
          <Input label="Title" maxLength={80} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <Textarea label="Description (optional)" rows={2} maxLength={200} placeholder="Open for paid collaborations, barter and events." value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
          <Input label="Button label (optional)" maxLength={30} placeholder="Send a brand enquiry" value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
          <FormChoice d={d} set={set} builtIn="Open my brand form here" />
          <p className="text-xs text-ink-500">{d.action === 'link' && d.url ? 'Enquiries go to your own form, so they won’t appear in Brand → Collabs.' : 'Enquiries arrive in Brand → Collabs, where you can track each one.'}</p>
        </div>
      )
    case 'tip':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" maxLength={80} placeholder="Support my work" value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <Input label="Button label" maxLength={30} placeholder="☕ Buy me a coffee" value={d.button || ''} onChange={(e) => set({ button: e.target.value })} />
          <Textarea className="sm:col-span-2" rows={2} label="Description (optional)" maxLength={200} value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
          <Input
            className="sm:col-span-2"
            label="Suggested amounts (₹, comma separated)"
            value={(d.amounts || []).join(', ')}
            onChange={(e) => set({ amounts: e.target.value.split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 10).slice(0, 3) })}
          />
        </div>
      )
    case 'products':
      return <ProductsPicker d={d} set={set} />
    case 'cards':
      return <CardsFields d={d} set={set} />
    case 'locked':
      return <LockedPicker d={d} set={set} />
    case 'latest_reel':
      return (
        <div className="grid gap-3">
          <Input label="Title (optional)" maxLength={60} value={d.title || ''} onChange={(e) => set({ title: e.target.value })} />
          <p className="text-xs text-ink-500">Shows your newest Reel automatically. Instagram data refreshes daily (or use Settings → Sync now).</p>
        </div>
      )
    default:
      return <p className="text-sm text-ink-500">Nothing to configure.</p>
  }
}
