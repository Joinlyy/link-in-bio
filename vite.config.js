import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Code-splitting is route-based (React.lazy in App.jsx), so charts, supabase-js and the
// editor only load on dashboard pages; public creator pages stay small.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
