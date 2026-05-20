import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log(
  '%c' +
  ' ████████╗██╗ ██████╗ ██████╗ ███████╗██╗   ██╗\n' +
  '    ██╔══╝██║██╔═══██╗██╔══██╗██╔════╝██║   ██║\n' +
  '    ██║   ██║██║   ██║██║  ██║█████╗   ╚██╗██╔╝\n' +
  '    ██║   ██║██║   ██║██║  ██║██╔══╝    ╚███╔╝ \n' +
  '    ██║   ██║╚██████╔╝██████╔╝███████╗  ██╔██╗ \n' +
  '    ╚═╝   ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═╝ ╚═╝\n\n' +
  '         desenvolvido com ♥ por tiodev          ',
  'color:#e50914;font-weight:bold;font-size:12px;font-family:monospace;'
)

// Remove service workers/caches antigos que podem manter arquivos desatualizados.
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister()
      })
    })
  }

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key)
      })
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
