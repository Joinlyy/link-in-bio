// Dependency-free image helpers (safe for the public bundle).

/** Hook for resizing/format conversion. Supabase image transforms need a paid plan, so URLs pass through. */
export function optimizedImage(url) {
  return url
}

export function formatBytes(n) {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}
