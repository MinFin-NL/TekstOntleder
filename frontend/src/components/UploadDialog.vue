<script setup lang="ts">
import { ref } from 'vue'
import { describeIssue, type ValidationIssue } from '../lib/validationErrors'
import type { DocumentResponse } from '../types/ljson'

// Matches MAX_UPLOAD_BYTES in backend/main.py; checked here too so a large file is never sent.
const MAX_BYTES = 5 * 1024 * 1024
const MAX_SHOWN = 8

defineProps<{ open: boolean }>()
const emit = defineEmits<{ loaded: [doc: DocumentResponse, fileName: string]; 'update:open': [open: boolean] }>()

interface UploadError {
  message: string
  issues: string[]
}

const busy = ref(false)
const error = ref<UploadError | null>(null)
// Bumped after a successful upload, so the dialog opens with an empty field next time.
const fieldKey = ref(0)
// A newer pick wins: answers to older uploads are ignored.
let latest = 0

async function upload(file: File) {
  const id = ++latest
  error.value = null
  if (file.size > MAX_BYTES) {
    error.value = { message: 'Het bestand is groter dan 5 MB', issues: [] }
    return
  }
  busy.value = true
  try {
    const res = await fetch('/api/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: file })
    const body = await res.json().catch(() => null)
    if (id !== latest) return
    if (res.ok) {
      fieldKey.value++
      emit('loaded', body as DocumentResponse, file.name)
      emit('update:open', false)
    } else error.value = toUploadError(res.status, body?.detail)
  } catch {
    if (id === latest) error.value = { message: 'De server is niet bereikbaar', issues: [] }
  } finally {
    if (id === latest) busy.value = false
  }
}

function toUploadError(status: number, detail: unknown): UploadError {
  if (typeof detail === 'string') return { message: detail, issues: [] }
  if (detail && typeof detail === 'object' && 'errors' in detail) {
    const { message, errors } = detail as { message: string; errors: ValidationIssue[] }
    return { message, issues: errors.map(describeIssue) }
  }
  return { message: `De server gaf status ${status}`, issues: [] }
}

function forget() {
  latest++
  busy.value = false
  error.value = null
}

function onChange(files: File[]) {
  if (files[0]) upload(files[0])
  // Cleared: forget the error, keep whatever document is shown.
  else forget()
}

function onClose() {
  // Closing cancels a pending upload: its answer must not swap the document afterwards.
  forget()
  emit('update:open', false)
}

// App.vue hands over files dropped on the document.
defineExpose({ upload })
</script>

<template>
  <nldd-modal-dialog
    :open="open"
    text="Eigen document openen"
    supporting-text="Kies een LJSON-bestand om de herkomst van de tekst te bekijken. Je kunt een bestand ook op het document slepen."
    horizontal-alignment="left"
    @close="onClose"
  >
    <nldd-container gap="12">
      <nldd-form-field
        label="LJSON-bestand"
        supporting-label="Maximaal 5 MB. Het bestand wordt gecontroleerd en getoond, niet opgeslagen."
      >
        <nldd-file-field
          :key="fieldKey"
          accept=".ljson,.json,application/json"
          :invalid="error !== null"
          @change="onChange($event.detail.files)"
        ></nldd-file-field>
      </nldd-form-field>
      <nldd-activity-indicator v-if="busy" size="24" text="Bestand wordt gecontroleerd"></nldd-activity-indicator>
      <nldd-banner v-if="error" variant="critical" size="sm" :text="error.message">
        <ul v-if="error.issues.length" class="to-issue-list to-text--sm">
          <li v-for="(issue, i) in error.issues.slice(0, MAX_SHOWN)" :key="i">{{ issue }}</li>
          <li v-if="error.issues.length > MAX_SHOWN">En nog {{ error.issues.length - MAX_SHOWN }} andere meldingen</li>
        </ul>
      </nldd-banner>
      <p class="to-text--sm to-variant-link">
        Geen bestand bij de hand? Bekijk het <a href="?">standaardvoorbeeld</a> of het
        <a href="?voorbeeld=genest">voorbeeld met geneste fragmenten</a>.
      </p>
    </nldd-container>
    <nldd-button slot="actions" variant="secondary" text="Annuleren" @click="onClose"></nldd-button>
  </nldd-modal-dialog>
</template>
