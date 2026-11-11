import { ArrowUpRightIcon } from '../icons'
import Sheet from './Sheet'

/** Shown in previews when a button is tapped, so creators can see what it does for visitors */
export default function PreviewNote({ note, onClose, onEdit }) {
  const sample = note.url?.includes('example.com')
  const canEdit = onEdit && (note.target || note.settings)
  const editButton = canEdit && (
    <button
      type="button"
      onClick={() => {
        onClose()
        onEdit(note.settings ? 'settings' : `${note.target}${note.url ? ':link' : ''}`)
      }}
      className={`mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold ${sample ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}
    >
      {sample ? 'Add my link' : note.settings ? 'Change in Settings' : note.url ? 'Change this link' : 'Edit this section'}
    </button>
  )
  return (
    <Sheet title="What this button does" onClose={onClose}>
      {note.text && <p className="text-sm leading-relaxed text-ink-700">{note.text}</p>}
      {note.url && sample && (
        <p className="rounded-2xl bg-lilac-100 p-4 text-sm leading-relaxed">
          This button still has an example link, so it doesn’t go anywhere yet. Add your own link to make it work.
        </p>
      )}
      {note.url && !sample && (
        <>
          <p className="text-sm leading-relaxed text-ink-700">On your live site, this opens:</p>
          <p className="mt-2 rounded-2xl bg-cream p-4 text-sm font-semibold break-all">{note.url}</p>
          <a href={note.url} data-preview-open target="_blank" rel="noopener noreferrer nofollow" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white">
            Open this link <ArrowUpRightIcon size={16} />
          </a>
        </>
      )}
      {editButton}
    </Sheet>
  )
}
