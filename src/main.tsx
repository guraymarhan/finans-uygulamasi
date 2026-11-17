import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { load, refreshRates } from './store'

load()
// Uygulama tekrar öne gelince kurları tazele
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshRates())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
