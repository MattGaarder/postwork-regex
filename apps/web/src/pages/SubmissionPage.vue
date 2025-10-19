// apps/web/src/pages/SubmissionPage.vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../lib/http';
import { socket } from '../lib/socket';
// import MonacoEditor from '@guolao/vue-monaco-editor'; // or your monaco wrapper
// pnpm -w add @guolao/vue-monaco-editor monaco-editor

const route = useRoute();
const id = Number(route.params.id);
const submission = ref(null);
const comments = ref([]);
const code = ref('');
const language = ref('javascript');
const posting = ref(false);
const newComment = ref({ line: null, body: '' });

async function load() {
  const { data } = await api.get(`/submissions/${id}`);
  submission.value = data;
  code.value = data.code;
  language.value = data.language;
  comments.value = data.comments ?? [];
}

function joinRoom() {
  socket.emit('join', id);
  socket.on('comment:created', (c) => {
    if (c.submissionId === id) comments.value.push(c);
  });
  socket.on('reaction:toggled', ({ commentId, kind, userId, action }) => {
    const idx = comments.value.findIndex(c => c.id === commentId);
    if (idx >= 0) {
      if (action === 'added') {
        comments.value[idx].reactions.push({ id: Date.now(), kind, userId });
      } else {
        comments.value[idx].reactions = comments.value[idx].reactions.filter(r => !(r.kind === kind && r.userId === userId));
      }
    }
  });
  socket.on('submission:updated', ({ id: subId, code: newCode }) => {
    if (subId === id) code.value = newCode;
  });
}

// async function saveCode() {
//   const { data } = await api.patch(`/submissions/${id}`, { code: code.value });
//   // you’ll also receive realtime change via socket, but updating locally is fine
// }

async function postComment() {
  posting.value = true;
  try {
    const payload = { submissionId: id, line: newComment.value.line, body: newComment.value.body };
    const { data } = await api.post('/comments', payload);
    comments.value.push(data); // optimistic; real-time event will also add it
    newComment.value = { line: null, body: '' };
  } finally {
    posting.value = false;
  }
}

onMounted(async () => {
  await load();
  joinRoom();
});

onBeforeUnmount(() => {
  socket.off('comment:created');
  socket.off('reaction:toggled');
  socket.off('submission:updated');
});
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8 editor-wrap">
        <!-- <MonacoEditor
          v-model:value="code"
          :language="language"
          :height="600"
          theme="vs-dark"
          @editor-mounted="(editor) => {
            // capture selection line for comments
            editor.onDidChangeCursorSelection(e => {
              const line = editor.getSelection()?.getStartPosition().lineNumber ?? null
              newComment.line = line
            })
          }"
        /> -->
        <div class="q-mt-sm">
          <!-- <q-btn color="primary" label="Save Code" @click="saveCode" /> -->
        </div>
      </div>

      <div class="col-12 col-md-4">
        <q-card>
          <q-card-section>
            <div class="text-subtitle1">Comments</div>
            <div class="text-caption">Line: {{ newComment.line ?? '—' }}</div>
            <q-input v-model="newComment.body" type="textarea" autogrow label="Write feedback…" />
            <q-btn class="q-mt-sm" :loading="posting" label="Post" color="primary" @click="postComment" :disable="!newComment.body"/>
          </q-card-section>
          <q-separator />
          <q-list>
            <q-item v-for="c in comments" :key="c.id">
              <q-item-section>
                <div class="text-caption text-grey">Line {{ c.line ?? '—' }} · {{ c.author?.name ?? 'Anon' }}</div>
                <div>{{ c.body }}</div>
                <div class="q-mt-xs">
                  <q-btn dense flat icon="thumb_up" @click="api.post('/reactions/toggle', { commentId: c.id, kind: 'like' })" />
                  <span class="q-ml-xs">{{ (c.reactions || []).filter(r => r.kind==='like').length }}</span>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<style>
    .editor-wrap {
        height: 700px;
    }
</style>