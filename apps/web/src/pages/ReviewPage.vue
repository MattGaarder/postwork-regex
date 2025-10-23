<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import * as monaco from 'monaco-editor';
import { api } from '@/lib/api';
import { useComments } from '@/composables/useComments';
import { buildCommentDecorations, applyDecorations } from '@/lib/monacoComments';

const route = useRoute();
const versionId = Number(route.params.versionId);
const editorEl = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

const code = ref('');
const language = ref('javascript');
const { threads, load, add } = useComments(versionId);
let decoCollection: monaco.editor.IEditorDecorationsCollection | null = null;

onMounted(async () => {
  const { data: v } = await api.get(`/versions/${versionId}`);
  code.value = v.content;
  language.value = v.language.toLowerCase();

  editor = monaco.editor.create(editorEl.value!, {
    value: code.value,
    language: language.value,
    readOnly: true,
    glyphMargin: true,
    automaticLayout: true,
    minimap: { enabled: false },
  });

  await load();
  const decorations = buildCommentDecorations(threads.value.map((t: any) => ({ line: t.line })));
  decoCollection = applyDecorations(editor, decorations);

  editor.onMouseDown((e) => {
    if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS ||
        e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT) {
      const line = e.target.position?.lineNumber;
      if (!line) return;
      openNewComment(line);
    }
  });
});

const showDialog = ref(false);
const draftLine = ref<number | null>(null);
const draftBody = ref('');

function openNewComment(line: number) {
  draftLine.value = line;
  draftBody.value = '';
  showDialog.value = true;
}

async function submitComment() {
  if (!draftLine.value || !draftBody.value.trim()) return;
  await add({ line: draftLine.value, body: draftBody.value.trim() });
  // refresh decorations
  const decorations = buildCommentDecorations(threads.value.map((t: any) => ({ line: t.line })));
  decoCollection?.set(decorations);
  showDialog.value = false;
}
</script>

<template>
  <div class="row q-gutter-md">
    <div class="col-12 col-md-8">
      <div ref="editorEl" style="height: 70vh; border: 1px solid #e0e0e0"></div>
    </div>
    <div class="col-12 col-md-4">
      <q-list bordered class="rounded-borders">
        <q-item-label header>Comments</q-item-label>
        <template v-for="t in threads" :key="t.id">
          <q-item clickable>
            <q-item-section>
              <div class="text-caption">Line {{ t.line }} · {{ t.author?.name || t.author?.email }}</div>
              <div>{{ t.body }}</div>
            </q-item-section>
          </q-item>
          <div class="q-ml-lg q-mb-md">
            <div v-for="c in t.children" :key="c.id" class="q-mt-xs">
              <div class="text-caption">{{ c.author?.name || c.author?.email }}</div>
              <div>{{ c.body }}</div>
            </div>
            <q-btn dense flat icon="add_comment" label="Reply" @click="openNewComment(t.line)" />
          </div>
          <q-separator spaced />
        </template>
      </q-list>
    </div>
  </div>

  <q-dialog v-model="showDialog">
    <q-card>
      <q-card-section class="text-subtitle1">New comment on line {{ draftLine }}</q-card-section>
      <q-card-section>
        <q-input v-model="draftBody" type="textarea" autogrow filled />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn color="primary" label="Add" @click="submitComment" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>