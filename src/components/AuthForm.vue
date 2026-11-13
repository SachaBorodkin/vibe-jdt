<script setup>
import { ref } from 'vue'
import { supabase } from '../supabaseClient'

const email = ref('')
const password = ref('')
const mode = ref('login')
const busy = ref(false)
const msg = ref('')
const err = ref('')

async function submit() {
  busy.value = true
  msg.value = ''
  err.value = ''
  const creds = { email: email.value, password: password.value }
  if (mode.value === 'login') {
    const { error } = await supabase.auth.signInWithPassword(creds)
    if (error) err.value = error.message
  } else {
    const { data, error } = await supabase.auth.signUp(creds)
    if (error) err.value = error.message
    else if (!data.session) msg.value = 'Compte créé. Vérifie tes e-mails pour confirmer, puis connecte-toi.'
  }
  busy.value = false
}
</script>

<template>
  <div class="auth-wrap">
    <form class="card auth" @submit.prevent="submit">
      <h1>Journal de travail</h1>
      <p class="muted">{{ mode === 'login' ? 'Connecte-toi pour accéder à ton journal.' : 'Crée ton compte.' }}</p>
      <label>E-mail<input v-model="email" type="email" required autocomplete="email" /></label>
      <label>Mot de passe<input v-model="password" type="password" required minlength="6" autocomplete="current-password" /></label>
      <p v-if="err" class="error">{{ err }}</p>
      <p v-if="msg" class="ok">{{ msg }}</p>
      <button class="primary" :disabled="busy">{{ mode === 'login' ? 'Se connecter' : "S'inscrire" }}</button>
      <button type="button" class="link" @click="mode = mode === 'login' ? 'signup' : 'login'">
        {{ mode === 'login' ? 'Pas de compte ? Inscris-toi' : 'Déjà un compte ? Connecte-toi' }}
      </button>
    </form>
  </div>
</template>
