import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Seules les variables préfixées JDT_ sont exposées au navigateur.
  // (Surtout pas SUPABASE_ : l'intégration Vercel y met la service_role key.)
  envPrefix: 'JDT_',
})
