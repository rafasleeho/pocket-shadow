import { supabase } from './lib/supabase'
supabase.from('ps_prompts').select('*').limit(1).then(({ data, error }) => console.log('DB check:', data, error))

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './PocketShadow'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
