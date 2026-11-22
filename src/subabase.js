import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qehfetpytwkksupovtjz.supabase.co'

// Replace this with your Supabase publishable key.
const SUPABASE_KEY = 'sb_publishable_9LqR3q7b16voUeCBdwio3A_daVnnsag'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
)
