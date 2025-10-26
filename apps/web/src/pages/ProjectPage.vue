
<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ project?.name || 'Loading...' }} — Version {{ versionId ?? 'latest' }}</div>
      <q-space />
      <q-btn dense label="Refresh" :loading="isLoading" @click="refresh" />
      <q-btn dense color="primary" class="q-ml-sm" label="Save" :loading="isSaving" @click="saveCurrent" />
    </div>

    <div class="text-caption text-grey-7 q-mb-sm">
      Created: {{ createdAt ? new Date(createdAt).toLocaleString() : '—' }} —
      Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : '—' }}
    </div>

    <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">
      {{ errorMsg }}
    </q-banner>
  
    <MonacoEditor
        :language="language"
        theme="vs-dark"
        height="600px"                
        width="100%"                   
        :options="{ automaticLayout: true, glyphMargin: true }"
        @mount="onMonacoMount"
    />

    <div class="text-caption text-grey q-mt-sm">Last updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : '—' }}</div>
    <div class="text-caption text-grey q-mt-sm">
        WS: {{ status }} — Room: {{ `project-${projectId}-v-${versionId ?? 'latest'}` }}
    </div>

    <q-dialog v-model="showCommentDialog">
      <q-card style="min-width: 420px">
        <q-card-section class="text-subtitle1">
          Add comment on line {{ pendingLine }}
        </q-card-section>
        <q-card-section>
          <q-input v-model="pendingBody" type="textarea" autogrow label="Comment" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :disable="!pendingBody" @click="submitComment" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- (Simple) side panel showing comments for the active line -->
    <div v-if="activeLine" class="q-mt-md">
      <div class="text-subtitle2">Comments for line {{ activeLine }}</div>
      <q-list bordered dense>
        <template v-if="lineThreads[activeLine] && lineThreads[activeLine].length">
          <q-item v-for="root in lineThreads[activeLine]" :key="root.id">
            <q-item-section>
              <div class="text-body2">{{ root.content }}</div>
              <div class="text-caption text-grey">
                by {{ root.author?.name || root.author?.email }} at {{ new Date(root.createdAt).toLocaleString() }}
              </div>
              <div v-if="root.children?.length" class="q-mt-xs">
                <div
                  v-for="child in root.children"
                  :key="child.id"
                  class="text-caption"
                >
                  ↳ {{ child.content }} — {{ child.author?.name || child.author?.email }}
                </div>
              </div>
            </q-item-section>
          </q-item>
        </template>
        <q-item v-else>
          <q-item-section> No comments yet. </q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-page>
</template>

<script setup lang="ts">

  import MonacoEditor from '@guolao/vue-monaco-editor';
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { api } from '../lib/http';
  import { useVersion } from '../composables/useVersion';
  import { useYDoc } from '../composables/useYDoc';

  const route = useRoute();
  const router = useRouter();

  const projectId = Number(route.params.projectId);
  const rawVersion = route.params.versionId
  const versionId = (typeof rawVersion === 'string' && /^\d+$/.test(rawVersion)) ? Number(rawVersion) : null
  const project = ref<any>(null);

  const {
    language, createdAt, updatedAt,
    isLoading, isSaving, errorMsg, refresh, save
  } = useVersion(projectId, Number(versionId || 0));

  type Comment = {
    id: number;
    versionId: number;
    line: number;
    content?: string;
    author?: { id: number; name?: string|null; email?: string };
    parentId?: number|null;
    children?: Comment[];
    createdAt?: string;
    updatedAt?: string;
  };

  const comments = ref<Comment[]>([]);               // root threads w/ children
  const lineThreads = ref<Record<number, Comment[]>>({});
  const activeLine = ref<number | null>(null);

  const showCommentDialog = ref(false);
  const pendingLine = ref<number | null>(null);
  const pendingBody = ref('');

  // monaco refs
  let editorRef: any = null;
  let monacoRef: any = null;
  let modelDispose: any = null;
  let yObserverDispose: any = null;

  let hoverDecorationIds: string[] = [];
  let commentDecorationIds: string[] = [];

  // Build a stable room name per project+version:
  const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
  const { doc, status } = useYDoc(room);            // connect to ws://localhost:1234
  const ytext = doc.getText('code');                // shared text “code”

  // helpers
  const byLine = (arr: Comment[]) => {
    const map: Record<number, Comment[]> = {};
    for (const root of arr) {
      if (!map[root.line]) map[root.line] = [];
      map[root.line].push(root);
    }
    return map;
  };

  function saveCurrent() {
    const text = editorRef?.getModel()?.getValue() ?? ''
    save(text) // this hits existing save(newContent?: string)  -- useVersion.ts
  }

  async function loadProject() {
    try {
      const { data } = await api.get(`/projects`);
      project.value = data.find((p: any) => p.id === projectId);
    } catch (err) {
      console.error(err);
      errorMsg.value = 'Failed to load project.';
      return; 
    }
  }

  async function fetchComments() {
    if (!versionId) return;
    const { data } = await api.get(`/projects/${projectId}/v/${versionId}/comments`);
    comments.value = data;
    lineThreads.value = byLine(comments.value);
    renderCommentDecorations();
  }

  function renderCommentDecorations() {
  if (!editorRef || !monacoRef) return;
  const model = editorRef.getModel();
  if (!model) return;
  // clear old
    commentDecorationIds = editorRef.deltaDecorations(commentDecorationIds, []);
    // build new (one decoration per line that has comments)
    const decos = Object.keys(lineThreads.value).map((ln) => {
      const line = Number(ln);
      return {
        range: new monacoRef.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'cmt-has',
          glyphMarginHoverMessage: { value: `Comments on line ${line}` },
          stickiness: 1, // NeverGrowsWhenTypingAtEdges (default OK too)
        },
      };
    });
    commentDecorationIds = editorRef.deltaDecorations(commentDecorationIds, decos);
  }

function openAddDialogForLine(line: number) {
  pendingLine.value = line;
  pendingBody.value = '';
  showCommentDialog.value = true;
}

  async function submitComment() {
    if (!versionId || !pendingLine.value || !pendingBody.value) return;
    try {
      const payload = { line: pendingLine.value, body: pendingBody.value };
      await api.post(`/projects/${projectId}/v/${versionId}/comments`, payload);
      showCommentDialog.value = false;
      await fetchComments();
      activeLine.value = pendingLine.value;
      // reveal and select line
      editorRef?.revealLineInCenter(activeLine.value);
    } catch (err) {
      console.error(err);
      (errorMsg as any).value = 'Failed to add comment.';
    }
  }

  onMounted(async () => {
    await loadProject();

    if (!Number.isFinite(versionId as any)) {
      try {
        const { data: versions } = await api.get(`/projects/${projectId}/v`);
        if (Array.isArray(versions) && versions.length > 0) {
          return router.replace(`/projects/${projectId}/v/${versions[0].id}`);
        } else {
          const { data: created } = await api.post(`/projects/${projectId}/v`, { code: '' });
          return router.replace(`/projects/${projectId}/v/${created.id}`);
        }
      } catch (error) {
        (errorMsg as any).value = 'Could not resolve version.';
        console.error(error);
        return;
      }
    }

    await refresh();
    await fetchComments();
  });

  onBeforeUnmount(() => {
    if (modelDispose) modelDispose.dispose();
    if (yObserverDispose) yObserverDispose();
  });

  function onMonacoMount(editor: any, monaco: any) {
    editorRef = editor;
    monacoRef = monaco;

    const model = editor.getModel();
    model.setValue(ytext.toString());

    // local edits -> yjs
    const disposeLocal = editor.onDidChangeModelContent(() => {
      const next = model.getValue();
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, next);
      });
    });
    modelDispose = disposeLocal;

    // yjs -> model
    const yObs = () => {
      const next = ytext.toString();
      if (model.getValue() !== next) model.setValue(next);
    };
    ytext.observe(yObs);
    yObserverDispose = () => ytext.unobserve(yObs);

    // hover: show "+" on glyph margin
    editor.onMouseMove((e: any) => {
      const t = e.target?.type;
      const pos = e.target?.position;
      if (!pos) return;
      const isGlyph =
        t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        t === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

      // clear old hover deco
      hoverDecorationIds = editor.deltaDecorations(hoverDecorationIds, []);

      if (isGlyph) {
        hoverDecorationIds = editor.deltaDecorations(hoverDecorationIds, [
          {
            range: new monaco.Range(pos.lineNumber, 1, pos.lineNumber, 1),
            options: {
              isWholeLine: true,
              glyphMarginClassName: 'cmt-plus',
              glyphMarginHoverMessage: { value: 'Add comment' },
            },
          },
        ]);
      }
    });

    // click: open dialog if clicking the glyph margin “+”
    editor.onMouseDown((e: any) => {
      const t = e.target?.type;
      const pos = e.target?.position;
      if (!pos) return;

      const clickedGlyph =
        t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        t === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        t === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS;

      if (clickedGlyph) {
        activeLine.value = pos.lineNumber;
        openAddDialogForLine(pos.lineNumber);
      } else if (t === monaco.editor.MouseTargetType.CONTENT_TEXT) {
        // clicking inside content can set the active line (to show the side panel)
        activeLine.value = pos.lineNumber;
      }
    });

    // initial render of comment markers
    renderCommentDecorations();
  }
</script>

<style>
  .monaco-editor .cmt-plus::before {
    content: "+";
    display: inline-block;
    font-weight: 700;
    font-size: 12px;
    line-height: 14px;
    width: 14px;
    height: 14px;
    text-align: center;
    border-radius: 50%;
    border: 1px solid currentColor;
    transform: translateY(1px);
  }

  /* Marker for lines that have comments */
  .monaco-editor .cmt-has {
    background: currentColor;
    mask: radial-gradient(circle at 50% 50%, #000 60%, transparent 61%);
    -webkit-mask: radial-gradient(circle at 50% 50%, #000 60%, transparent 61%);
    width: 10px; height: 10px;
    border-radius: 50%;
  }
</style>