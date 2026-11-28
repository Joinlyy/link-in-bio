// A calendar invite (.ics). Gmail, Apple Mail and Outlook show an "Add to calendar" card for it.
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const fold = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

export function makeIcs(o: { uid: string; title: string; start: string; end: string; details?: string; url?: string; sequence?: number }): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Joinlyy//Sessions//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.uid}@joinlyy.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `SEQUENCE:${o.sequence ?? 0}`,
    `DTSTART:${stamp(new Date(o.start))}`,
    `DTEND:${stamp(new Date(o.end))}`,
    `SUMMARY:${fold(o.title)}`,
    ...(o.details ? [`DESCRIPTION:${fold(o.details)}`] : []),
    ...(o.url ? [`URL:${o.url}`, `LOCATION:${fold(o.url)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Starting soon', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

/** Base64 of a UTF-8 string, for an email attachment */
export function b64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
