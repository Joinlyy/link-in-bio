import BlockView from './BlockView'
import Sheet from './Sheet'

/** The creator's Home lead form, opened as a popup. Loaded only when it's about to show */
export default function LeadPopup({ block, ctx, onClose }) {
  return (
    <Sheet title={block.data.title || 'Stay in touch'} hideTitle onClose={onClose}>
      <BlockView block={block} ctx={ctx} />
    </Sheet>
  )
}
