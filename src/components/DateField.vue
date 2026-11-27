<script setup>
import { ref, watch } from 'vue'
import { fmtDateSlash, parseDateInput } from '../lib/format'
import Icon from './Icon.vue'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const native = ref(null)
const text = ref(fmtDateSlash(props.modelValue))

watch(
  () => props.modelValue,
  (v) => {
    text.value = fmtDateSlash(v)
  },
)

/** Valide la saisie (jj/mm/aaaa) et remonte la date en ISO ; une saisie invalide est annulée. */
function commit() {
  const iso = parseDateInput(text.value)
  if (!iso) {
    text.value = fmtDateSlash(props.modelValue)
    return
  }
  text.value = fmtDateSlash(iso)
  if (iso !== props.modelValue) emit('update:modelValue', iso)
}

function onNative(ev) {
  const iso = ev.target.value
  if (!iso) return
  text.value = fmtDateSlash(iso)
  emit('update:modelValue', iso)
}

/** Ouvre le calendrier natif depuis le bouton (le champ date reste masqué). */
function openPicker() {
  const el = native.value
  if (!el) return
  try {
    el.showPicker()
  } catch {
    el.focus()
  }
}
</script>

<template>
  <div class="datefield">
    <input
      class="date-text"
      :value="text"
      placeholder="jj/mm/aaaa"
      inputmode="numeric"
      autocomplete="off"
      aria-label="Date (jj/mm/aaaa)"
      @change="commit"
      @blur="commit"
      @keydown.enter.prevent="$event.target.blur()"
    />
    <button
      type="button"
      class="date-pick"
      title="Choisir dans le calendrier"
      aria-label="Choisir dans le calendrier"
      @click="openPicker"
    >
      <Icon name="calendar" size="15" />
    </button>
    <input
      ref="native"
      class="date-native"
      type="date"
      :value="modelValue"
      tabindex="-1"
      aria-hidden="true"
      @change="onNative"
    />
  </div>
</template>
