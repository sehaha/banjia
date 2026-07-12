import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import UpdatePrompt from './components/UpdatePrompt.tsx'
import { I18nProvider } from './lib/i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Root />
      <UpdatePrompt />
    </I18nProvider>
  </StrictMode>,
)
