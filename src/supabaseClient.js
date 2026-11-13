import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.JDT_SUPABASE_URL
const key = import.meta.env.JDT_SUPABASE_ANON_KEY

export const configured = Boolean(url && key && !url.includes('xxxxxxxx'))
export const supabase = configured ? createClient(url, key) : null
