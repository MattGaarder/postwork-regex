<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ project?.name || 'Loading...' }}</div>
      <q-space />
      <q-btn dense label="Refresh" :loading="isLoading" @click="refresh" />
      <q-btn dense color="primary" class="q-ml-sm" label="Save" :loading="isSaving" @click="save()" />
    </div>

    <div class="text-caption text-grey-7 q-mb-sm">
      Created: {{ createdAt ? new Date(createdAt).toLocaleString() : '—' }} —
      Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : '—' }}
    </div>

    <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">
      {{ errorMsg }}
    </q-banner>
    <!-- https://github.com/imguolao/monaco-vue -->
     <!-- v-model:value="content" -->
    <MonacoEditor
        
        :language="language"
        theme="vs-dark"
        height="600px"                
        width="100%"                   
        :options="{ automaticLayout: true }"

        @mount="onMonacoMount"
    />
    <div class="text-caption text-grey q-mt-sm">Last updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : '—' }}</div>

    <div class="text-caption text-grey q-mt-sm">
        WS: {{ status }} — Room: {{ `project-${projectId}-v-${versionId ?? 'latest'}` }}
    </div>


    <!-- <div class="q-mb-md editor-container">
      <q-input v-model="form.title" label="Title" dense />



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
    </q-card> -->

  </q-page>
</template>

<script setup>
    import MonacoEditor from '@guolao/vue-monaco-editor';
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { api } from '../lib/http';
    import { useVersion } from '../composables/useVersion';
    import { useYDoc } from '../composables/useYDoc';



    const route = useRoute();
    const router = useRouter();
    const projectId = Number(route.params.projectId);
    // Grab the raw param (could be undefined or a string)
    const rawVersion = route.params.versionId

    // Parse to a number only if it’s a string of digits; otherwise null
    const versionId = (typeof rawVersion === 'string' && /^\d+$/.test(rawVersion)) ? Number(rawVersion) : null

    const project = ref(null);



    const {
        language, createdAt, updatedAt,
        isLoading, isSaving, errorMsg, refresh, save
    } = useVersion(projectId, Number(versionId || 0))
    console.log(updatedAt);

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
        // try {
        //     const subRes = await api.get(`/projects/${projectId}/submissions`);
        //     submissions.value = subRes.data;
        // } catch (err) {
        //     // If the route exists, this shouldn't 404 anymore
        //     // if it does, treat that as "no submissions yet"
        //     console.warn('Could not load submissions:', err);
        //     submissions.value = [];
        // }
    }

    // async function createSubmission() {
    // try {
    //     const payload = { projectId, ...form.value }
    //     const { data } = await api.post('/submissions', payload)
    //     submissions.value.unshift(data)
    //     showEditor.value = false
    //     form.value = { title: '', language: 'javascript', code: '' }
    // } catch (err) {
    //     console.error(err)
    //     errorMsg.value = 'Error submitting code.'
    // }
    // }

    // function openSubmission(id) {
    // router.push(`/submissions/${id}`)
    // }

    
    onMounted(async () => {
    console.log('[ProjectPage] mount projectId=', projectId, 'versionId=', versionId);
    await loadProject();

    // If versionId is missing, route to latest (or create one)
    if (!Number.isFinite(versionId)) {
        try {
        const { data: versions } = await api.get(`/projects/${projectId}/v`);
        if (Array.isArray(versions) && versions.length > 0) {
            // newest first per your API orderBy
            return router.replace(`/projects/${projectId}/v/${versions[0].id}`);
        } else {
            // no versions yet → create the first one
            const { data: created } = await api.post(`/projects/${projectId}/v`, { content: '' });
            return router.replace(`/projects/${projectId}/v/${created.id}`);
        }
        } catch (error) {
        errorMsg.value = 'Could not resolve version.';
        console.error('Logout error:', error);
        return;
        }
    }

    // Only refresh when we actually have a numeric versionId
    await refresh();
    });

    // Build a stable room name per project+version:
    const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
    const { doc, status } = useYDoc(room);            // connect to ws://localhost:1234
    const ytext = doc.getText('code');                // shared text “code”


    function onMonacoMount(editor) {
    const model = editor.getModel()

    // 1) initialize editor from Y
    model.setValue(ytext.toString())

    // 2) local → Y (simple approach: replace all — good enough to prove syncing)
    const disposeLocal = editor.onDidChangeModelContent(() => {
        const next = model.getValue()
        doc.transact(() => {
        ytext.delete(0, ytext.length)
        ytext.insert(0, next)
        })
    })

    // 3) Y → local
    const yObserver = () => {
        const next = ytext.toString()
        if (model.getValue() !== next) model.setValue(next)
    }
    ytext.observe(yObserver)

    // cleanup
    onBeforeUnmount(() => {
        disposeLocal.dispose()
        ytext.unobserve(yObserver)
    })
    }
</script>

<style>

    .editor-container {
        height: 700px;
        width: 700px;
        z-index: 1000;
    }
</style>