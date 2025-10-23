<template>
  <q-page padding>

    <div class="row q-mb-md nav space-between">
      <div class="text-h5 nav-header">My Projects</div>
      <div class="nav-buttons flex">
        <q-btn color="primary" label="Refresh" :loading="isLoading" @click="fetchProjects" />
        <q-btn color="primary" class="float-right" label="Logout" @click="logout" />
      </div>
    </div>

    <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">
      {{ errorMsg }}
    </q-banner>

    <!-- Create new project -->
    <q-card class="q-mb-md">
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <q-input v-model="form.name" label="Project name" dense />
        </div>
        <div class="col-12 col-md-4">
          <q-input v-model="form.description" type="textarea" autogrow label="Description (optional)" dense />
        </div>
        <div class="col-12 col-md-4">
          <q-select
            v-model="form.language"
            :options="languageOptions"
            label="Language"
            dense
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-2 flex items-end">
          <q-btn
            color="primary"
            label="Create"
            :loading="isCreating"
            :disable="!form.name"
            @click="createProject"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Projects list -->
    <q-inner-loading :showing="isLoading">
      <q-spinner />
    </q-inner-loading>

    <div v-if="projects.length === 0 && !isLoading" class="text-grey q-mt-md">
      No projects yet — create your first one above.
    </div>

    <q-card
      v-for="p in projects"
      :key="p.id"
      class="q-mb-sm cursor-pointer"
      @click="openProject(p.id)"
    >
      <q-card-section class="row project-row">
        <div class="project">
            <div class="text-subtitle1">{{ p.name }}</div>
            <div class="text-caption">{{ p.description ?? '—' }}</div>
        </div>
        <q-card-actions align="right">
            <q-btn flat color="negative" label="Delete" :loading="deletingId === p.id" @click.stop="deleteProject(p.id)" />
        </q-card-actions>
      </q-card-section>

    </q-card>

  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/http'; // your axios instance (baseURL = VITE_API_URL)
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';   // your Pinia auth store

const router = useRouter();
const auth = useAuth();

const projects = ref([]);
const isLoading = ref(false);
const isCreating = ref(false);
const deletingId = ref(null);
const errorMsg = ref('');

const languageOptions = [
  { label: 'JavaScript', value: 'JAVASCRIPT' },
  { label: 'Python', value: 'PYTHON' },
  { label: 'Java', value: 'JAVA' }
];

const form = ref({
  name: '',
  description: '',
  language: 'JAVASCRIPT',
});

async function openProject(id) {
  console.log('[ProjectsPage] openProject ->', { id });

  try {
    // load versions newest-first (your backend already orders desc)
    const { data: versions } = await api.get(`/projects/${id}/v`);

    if (Array.isArray(versions) && versions.length > 0) {
      // go to the newest version
      const latest = versions[0]; // because orderBy createdAt:'desc'
      return router.push(`/projects/${id}/v/${latest.id}`);
    }

    // no versions yet → create the first one
    const { data: created } = await api.post(`/projects/${id}/v`, { content: '' });
    return router.push(`/projects/${id}/v/${created.id}`);
  } catch (err) {
    console.error('[ProjectsPage] openProject error', err);
    // Fallback to the project page (your guard there can resolve/redirect too)
    return router.push(`/projects/${id}`);
  }
}

async function fetchProjects () {
  errorMsg.value = ''
  isLoading.value = true
  try {
    const { data } = await api.get('/projects')
    projects.value = data
  } catch (err) {
    errorMsg.value = humanizeError(err)
  } finally {
    isLoading.value = false
  }
}

async function logout () {
    try {
        // Clear Pinia state
        auth.token = null;
        auth.user = null;
        // Remove persisted token if you save it
        localStorage.removeItem('jwt');
        // Optionally clear Axios default header
        delete api.defaults.headers.Authorization;
        // Navigate back to login page
        router.push('/login');
    } catch (err) {
        console.error('Logout error:', err);
    }
}

async function createProject () {
  errorMsg.value = ''
  isCreating.value = true
  try {
    const payload = {
      name: form.value.name,
      // your API wants string | null (not undefined)
      description: form.value.description ? form.value.description : null,
      language: form.value.language
    }
    const { data } = await api.post('/projects', payload)
    projects.value.unshift(data) // optimistic add
    form.value.name = ''
    form.value.description = ''
  } catch (err) {
    errorMsg.value = humanizeError(err)
  } finally {
    isCreating.value = false
  }
}

async function deleteProject (id) {
  errorMsg.value = ''
  deletingId.value = id
  try {
    await api.delete(`/projects/${id}`)
    projects.value = projects.value.filter(p => p.id !== id)
  } catch (err) {
    errorMsg.value = humanizeError(err)
  } finally {
    deletingId.value = null
  }
}

function humanizeError (err) {
  const status = err?.response?.status
  const msg = err?.response?.data?.error
  if (status === 401) return 'You must be logged in.'
  if (status === 400) return 'Invalid input.'
  return msg || 'Something went wrong.'
}

onMounted(fetchProjects)
</script>

<style>
    .nav {
        display: flex;
        justify-content: space-between;
    }
    .project-row {
        display: flex;
        justify-content: space-between;
    }
</style>