<template>
  <q-page padding>
    <MonacoEditor
        v-model:value="form.code"
        :language="form.language"
        theme="vs-dark"
        height="500px"                
        width="100%"                   
        :options="{ automaticLayout: true }"
        @mount="onMonacoMount"
    />
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ project?.name || 'Loading...' }}</div>
      <q-space />
      <q-btn color="primary" label="New Submission" @click="showEditor = true" />
    </div>

    <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">
      {{ errorMsg }}
    </q-banner>

    <div class="q-mb-md editor-container">
      <q-input v-model="form.title" label="Title" dense />
      <q-select
        v-model="form.language"
        :options="languageOptions"
        label="Language"
        dense
      />
      <!-- <q-input
        v-model="form.code"
        type="textarea"
        label="Code"
        autogrow
        filled
        class="q-mt-sm"
      /> -->

      <div class="q-mt-sm">
        <q-btn color="primary" label="Submit Code" @click="createSubmission" />
        <q-btn flat label="Cancel" @click="showEditor = false" />
      </div>
    </div>

    <q-separator class="q-my-md" />

    <div v-if="submissions.length === 0 && !isLoading" class="text-grey">
      No submissions yet — add one above.
    </div>

    <q-card v-for="s in submissions" :key="s.id" class="q-mb-sm cursor-pointer" @click="openSubmission(s.id)">
      <q-card-section>
        <div class="text-subtitle1">{{ s.title }}</div>
        <div class="text-caption text-grey">{{ s.language }}</div>
      </q-card-section>
    </q-card>

  </q-page>
</template>

<script setup>
import MonacoEditor from '@guolao/vue-monaco-editor'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/http'


const router = useRouter()
const route = useRoute()
const projectId = Number(route.params.projectId)

const project = ref(null)
const submissions = ref([])
const showEditor = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const form = ref({ title: '', language: 'javascript', code: '' })
const languageOptions = ['javascript', 'python', 'java'];

async function loadProject() {
  // Load the full list of projects and find the one we're viewing
  try {
    const { data } = await api.get(`/projects`);
    project.value = data.find(p => p.id === projectId);
  } catch (err) {
    console.error(err);
    errorMsg.value = 'Failed to load project.';
    return; // bail early; no point fetching submissions
  }

  try {
    const subRes = await api.get(`/projects/${projectId}/submissions`);
    submissions.value = subRes.data;
  } catch (err) {
    // If the route exists, this shouldn't 404 anymore
    // if it does, treat that as "no submissions yet"
    console.warn('Could not load submissions:', err);
    submissions.value = [];
  }
}

async function createSubmission() {
  try {
    const payload = { projectId, ...form.value }
    const { data } = await api.post('/submissions', payload)
    submissions.value.unshift(data)
    showEditor.value = false
    form.value = { title: '', language: 'javascript', code: '' }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'Error submitting code.'
  }
}

function openSubmission(id) {
  router.push(`/submissions/${id}`)
}

onMounted(loadProject)
</script>

<style>

    .editor-container {
        height: 700px;
        width: 700px;
        z-index: 1000;
    }
</style>