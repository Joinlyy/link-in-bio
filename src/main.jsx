import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// After a new deploy, a tab opened earlier asks for page files that no longer exist.
// Reload once to pick up the new version (the guard stops a reload loop if the files are really missing).
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try { last = Number(sessionStorage.getItem('reloaded-for-update')) || 0 } catch { /* storage blocked */ }
  if (Date.now() - last < 10_000) return
  event.preventDefault()
  try { sessionStorage.setItem('reloaded-for-update', String(Date.now())) } catch { /* storage blocked */ }
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable app: register the app-shell service worker in production builds only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('Service worker registration failed', err))
  })
}
