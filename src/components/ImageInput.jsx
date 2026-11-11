import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { uploadImage } from '../lib/storage'
import { optimizedImage } from '../lib/images'
import { useToast, InfoButton } from './ui'

/** Upload to the Supabase `creator-images` bucket */
export default function ImageInput({ value, onChange, folder = 'pages', round = false, label = 'Image' }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      onChange(await uploadImage(file, folder))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-700">{label} <InfoButton label={label} /></p>
      <div className="flex flex-col items-start gap-3">
        <div className={`grid shrink-0 place-items-center overflow-hidden bg-cream ring-1 ring-ink/10 ${round ? 'size-20 rounded-full' : 'h-20 w-28 rounded-2xl'}`}>
          {value ? <img src={optimizedImage(value, 240)} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-ink-400" />}
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
              </button>
              {value && (
                <button type="button" onClick={() => onChange('')} className="grid size-9 shrink-0 place-items-center rounded-full bg-cream hover:bg-red-50 hover:text-red-600" aria-label="Remove image">
                  <Trash2 className="size-4" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>
          <p className="text-xs text-ink-500">JPG, PNG or WebP · up to 5 MB</p>
        </div>
      </div>
    </div>
  )
}
