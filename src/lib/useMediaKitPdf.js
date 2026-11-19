import { useCallback, useState } from 'react'

/** "Download PDF" for a media kit: builds the file in the browser and saves it (no print dialog) */
export function useMediaKitPdf(page, instagram) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      // The PDF code is big: load it only now
      const { downloadMediaKitPdf } = await import('./mediaKitPdf')
      // Never leave the button stuck on "Preparing…" if something stalls
      let timer
      await Promise.race([
        downloadMediaKitPdf(page, instagram),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PDF took too long')), 60_000) }),
      ]).finally(() => clearTimeout(timer))
    } catch (err) {
      console.error('Media kit PDF failed', err)
      setError('Couldn’t create the PDF. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [busy, page, instagram])

  return { busy, error, download }
}
