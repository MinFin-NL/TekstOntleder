<script setup lang="ts">
import { ref } from 'vue'
import { describeIssue, type ValidationIssue } from '../lib/validationErrors'
import type { DocumentResponse } from '../types/ljson'

// Matches MAX_UPLOAD_BYTES in backend/main.py; checked here too so a large file is never sent.
const MAX_BYTES = 5 * 1024 * 1024
const MAX_SHOWN = 8

const emit = defineEmits<{ loaded: [doc: DocumentResponse, fileName: string] }>()

interface UploadError {
  message: string
  issues: string[]
}

const busy = ref(false)
const error = ref<UploadError | null>(null)
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
    if (res.ok) emit('loaded', body as DocumentResponse, file.name)
    else error.value = toUploadError(res.status, body?.detail)
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

function onChange(files: File[]) {
  if (files[0]) upload(files[0])
  else {
    // Cleared: forget the error, keep whatever document is shown.
    latest++
    busy.value = false
    error.value = null
  }
}
</script>

<template>
  <nldd-card accessible-label="Eigen document">
    <nldd-container padding="16" gap="12">
      <nldd-title size="5" heading-level="2" text="Eigen document openen"></nldd-title>
      <nldd-form-field
        label="LJSON-bestand"
        supporting-label="Maximaal 5 MB. Het bestand wordt gecontroleerd en getoond, niet opgeslagen."
      >
        <nldd-file-field
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
    </nldd-container>
  </nldd-card>
</template>
