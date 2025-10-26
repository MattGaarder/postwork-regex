<!-- src/pages/ProjectPageSimplest.vue -->
<template>
  <q-page padding>
    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="text-h6">Project {{ projectId }} — Version {{ versionId ?? 'latest' }}</div>
      <q-space />
      <q-btn dense label="Refresh comments" :loading="isLoadingComments" @click="fetchComments" />
      <q-btn dense color="primary" class="q-ml-sm" label="Save" :loading="isSaving" @click="saveCurrent" />
    </div>

     <!-- (we listen to @mount so we can read the caret later) -->
        <MonacoEditor
        :language="language"
        theme="vs-dark"
        height="500px"
        width="100%"
        :options="{ automaticLayout: true, glyphMargin: true, minimap: { enabled: false } }"
        @mount="onMonacoMount"
        />
        

    <!-- Add-comment dialog (opened when user clicks the gutter “+”) -->
    <!-- <q-dialog v-model="showCommentDialog">
      <q-card style="min-width:420px">
        <q-card-section class="text-subtitle1">
          Add comment on line {{ pendingLine }}
        </q-card-section>
        <q-card-section>
          <q-input v-model="pendingBody" type="textarea" autogrow label="Comment" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :disable="!pendingBody" @click="submitCommentFromDialog" />
        </q-card-actions>
      </q-card>
    </q-dialog> -->

    <!-- Add a comment: user types the line number explicitly -->
    <div class="q-mt-md">
      <div class="text-subtitle2">Add a comment</div>

      <div class="row q-col-gutter-sm items-start q-mt-sm">
        <!-- Read-only line field that follows the caret -->
        <div class="col-12 col-sm-3">
          <q-input
            v-model.number="newLine"
            type="number"
            label="Line number"
            :min="1"
            dense
            readonly
          />
        </div>

        <!-- ✅ New tiny button: copies the editor caret's line into the input -->
        <!-- <div class="col-12 col-sm-2 flex items-start">
          <q-btn
            outline
            class="q-mt-sm full-width"
            label="Use caret line"
            :disable="!editorRef"
            @click="useCaretLine"
          />
        </div> -->

        <div class="col-12 col-sm-7">
          <q-input
            v-model="newBody"
            type="textarea"
            autogrow
            label="Comment"
          />
        </div>
        <div class="col-12 col-sm-2 flex items-start">
          <q-btn
            color="primary"
            class="q-mt-sm full-width"
            label="Add Comment"
            :disable="!canSubmit"
            :loading="isPosting"
            @click="submitComment"
          />
        </div>
      </div>
    </div>

    <!-- Optional tiny helper text -->
    <div class="text-caption text-grey-7 q-mt-xs">
        Caret line: <b>{{ newLine || '—' }}</b>. Move the cursor in the editor to change it.
    </div>

    <!-- All comments (no filtering by active line) -->
    <div class="q-mt-md">
      <div class="text-subtitle2">All comments</div>

      <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">
        {{ errorMsg }}
      </q-banner>

      <q-list bordered dense v-if="sortedComments.length">
        <q-item v-for="c in sortedComments" :key="c.id" :id="`cmt-${c.id}`">
          <q-item-section>
            <div class="text-caption text-grey">
                Lines {{ c.lineStart === c.lineEnd ? c.lineStart : `${c.lineStart}–${c.lineEnd}` }}
            </div>
            <div class="text-body2">{{ c.content }}</div>
            <div class="text-caption text-grey">
              by {{ c.author?.name || c.author?.email || 'Unknown' }}
              — {{ new Date(c.createdAt).toLocaleString() }}
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <q-item v-else>
        <q-item-section>No comments yet.</q-item-section>
      </q-item>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// ──────────────────────────────────────────────────────────────────────────────
// Simplest possible flow (beginner-friendly):
// - No cursor/active-line tracking.
// - User types a line number and a comment.
// - We POST it, then re-fetch and list *all* comments.
// ──────────────────────────────────────────────────────────────────────────────
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MonacoEditor from '@guolao/vue-monaco-editor';
import { api } from '../lib/http';

import { watchEffect } from 'vue';


// NEW: import your Yjs + useVersion composable
import { useVersion } from '../composables/useVersion';
import { useYDoc } from '../composables/useYDoc';

const route = useRoute();
const router = useRouter();

// Route params → identify project/version
const projectId = Number(route.params.projectId);
const rawVersion = route.params.versionId;
const versionId = (typeof rawVersion === 'string' && /^\d+$/.test(rawVersion)) ? Number(rawVersion) : null;

// Editor language (not important for comments)
const language = ref<'javascript' | 'python' | 'java'>('javascript');

let rangeDecorationIds: string[] = [];

// Comment types
type UIComment = {
    id: number;
    versionId: number;
    //   line: number;
    lineStart: number;
    lineEnd: number;
    content: string;
    createdAt: string;
    author?: { id: number; name?: string | null; email?: string | null };
};

// State
const allComments = ref<UIComment[]>([]);
const isLoadingComments = ref(false);
const isPosting = ref(false);


// New comment inputs (explicit line number + text)
const newLine = ref<number | null>(null);
const newBody = ref('');

// Which lines comment will cover (normalized)
let pendingStart: number | null = null;
let pendingEnd: number | null = null;

// handle to the Monaco editor so we can read the caret line
let editorRef: any = null;

function captureSelectionOrLine(clickedLine: number) {
  // Ask Monaco for the current selection
  const sel = editorRef?.getSelection?.();

  if (sel && (sel.startLineNumber !== sel.endLineNumber)) {
    // Multi-line selection ⇒ normalize to [start..end]
    pendingStart = Math.min(sel.startLineNumber, sel.endLineNumber);
    pendingEnd   = Math.max(sel.startLineNumber, sel.endLineNumber);
  } else {
    // No selection or single line ⇒ just the clicked line
    pendingStart = clickedLine;
    pendingEnd   = clickedLine;
  }
}
// // dialog state used by the <q-dialog>
// const showCommentDialog = ref(false);
// const pendingLine = ref<number | null>(null);
// const pendingBody = ref('');
// Pick a stable room name per project+version
const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
// Connect to y-websocket (ws://… as configured in your composable)
const { doc /*, status*/ } = useYDoc(room);
// Single shared text named "code"
const ytext = doc.getText('code');

// One decoration that marks the current caret line with a "+" in the glyph margin
let caretDecorationIds: string[] = [];

// a disposables for sync listener
let disposeCursorListener: (() => void) | null = null;
let disposeLocalToY: (() => void) | null = null;
let disposeYToLocal: (() => void) | null = null;


// Small helper: replace the whole Y.Text safely
function setYText(text: string) {
// Think of transact like pressing “Pause notifications” while you do a batch of changes:
// 	1.	Pause updates.
// 	2.	Do your edits.
// 	3.	Resume updates and broadcast everything once - Collaborators never see the empty intermediate state.
  doc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, text);
  });
}


// Submit only if version, a positive line, and body are present
const canSubmit = computed(() =>
    Boolean(versionId && newLine.value && newLine.value > 0 && newBody.value.trim().length)
);

// Display all comments, sorted by line then by createdAt
const sortedComments = computed(() =>
    [...allComments.value].sort((a, b) =>
        a.lineStart === b.lineStart
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : a.lineStart - b.lineStart
  )
);

const {
    isSaving, errorMsg, code, save, refresh
} = useVersion(projectId, Number(versionId || 0));






//// -------------------
// NEW: we need monaco for ContentWidget API
let monacoRef: any = null;

// NEW: inline widget state (one at a time to keep it simple)
let inlineWidget: any | null = null;       // the widget object (getId/getDomNode/getPosition)
let inlineDom: HTMLElement | null = null;  // the DOM node used by the widget

// NEW: small helper to close + cleanup (safe to call multiple times)
function closeInlineWidget() {
  if (editorRef && inlineWidget) {
    editorRef.removeContentWidget(inlineWidget);
  }
  inlineWidget = null;
  inlineDom = null;
}



// NEW: build a simple DOM for the inline form
function makeInlineDom() {
  const el = document.createElement('div');
  el.className = 'mw-inline'; // styled below

  // very small markup; plain HTML to avoid pulling Quasar components into editor DOM
  el.innerHTML = `
    <div class="mw-head">Comment lines ${pendingStart} - ${pendingEnd}</div>
    <textarea class="mw-input" rows="3" placeholder="Type comment..."></textarea>
    <div class="mw-actions">
      <button class="mw-btn mw-cancel" type="button">Cancel</button>
      <button class="mw-btn mw-add" type="button">Add</button>
    </div>
  `;

  // wire up buttons
  const ta   = el.querySelector('.mw-input') as HTMLTextAreaElement;
  const btnAdd = el.querySelector('.mw-add') as HTMLButtonElement;
  const btnCancel = el.querySelector('.mw-cancel') as HTMLButtonElement;

  // focus text area when shown
  setTimeout(() => ta?.focus(), 0);

  btnCancel.addEventListener('click', () => closeInlineWidget());

  btnAdd.addEventListener('click', async () => {
    if (!versionId) return;
    const body = (ta.value || '').trim();
    if (!body) return;

    try {
      // POST /projects/:projectId/v/:versionId/comments
      await api.post(`/projects/${projectId}/v/${versionId}/comments`, {
        lineStart: pendingStart,
        lineEnd: pendingEnd,
        body,
      });
      await fetchComments();                   // refresh list
      editorRef?.revealLineInCenter(pendingStart);
      closeInlineWidget();                     // hide the inline form
      pendingStart = pendingEnd = null;
    } catch (err) {
      console.error(err);
      errorMsg.value = 'Failed to add comment.';
    }
  });

  return el;
}

// NEW: create or move the inline content widget to `line`
function showInlineWidgetAtLine(line: number) {
    if (!editorRef || !monacoRef) return;


    const anchor = (pendingStart ?? line);
    // (re)build DOM
    inlineDom = makeInlineDom();

    // widget API object Monaco expects
    const id = 'comment.inline.widget';
    const widget = {
        getId: () => id,
        getDomNode: () => inlineDom!,
        getPosition: () => ({
            position: { lineNumber: anchor, column: 1 },
            // Try exact (touch the anchor), then below if needed
            preference: [
                monacoRef.editor.ContentWidgetPositionPreference.EXACT,
                monacoRef.editor.ContentWidgetPositionPreference.BELOW,
            ],
        }),
        allowEditorOverflow: true,
        suppressMouseDown: false,
    };

    if (!inlineWidget) {
        inlineWidget = widget;
        editorRef.addContentWidget(inlineWidget);
    } else {
        // move existing one
        inlineWidget.getPosition = widget.getPosition;
        inlineWidget.getDomNode = widget.getDomNode;
        editorRef.layoutContentWidget(inlineWidget);
    }
}
// ----------------------------




// Mount handler: store the editor instance
function onMonacoMount(editor: any, monaco: any) {
    editorRef = editor;
    monacoRef = monaco;
    // get Monaco model
    const model = editorRef.getModel();
    // INITIAL SEED:
    // If Yjs already has content (someone else typed / reconnect), prefer it.
    // Otherwise, if you already loaded "code" from backend, seed Yjs from that.
    // set initial caret-based line on mount 
    const yHasText = ytext.length > 0;
    if (yHasText) {
        model.setValue(ytext.toString());
    } else {
        // If your useVersion.refresh() has put the latest code somewhere (e.g. code.value),
        // you can seed Yjs here. If you don’t track code.value in this page, seed empty.
        const initial = model.getValue() ?? '';
        setYText(initial);
    }
    // LOCAL → Yjs: whenever Monaco changes, write to Y.Text
    const localSub = editorRef.onDidChangeModelContent(() => {
        const next = model.getValue();
        // Write-through into Y.Text; guard with a quick equality check
        if (next !== ytext.toString()) setYText(next);
    });
    disposeLocalToY = () => localSub.dispose();

    // Yjs → LOCAL: observe Y.Text and update Monaco when remote changes arrive
    const yObserver = () => {
        const next = ytext.toString();
        if (model.getValue() !== next) {
            const pos = editorRef.getPosition?.(); // keep caret stable if you want
            model.setValue(next);
            if (pos) editorRef.setPosition(pos);
        }
    };
    if (editorRef && code.value) {
        const model = editorRef.getModel?.();
        if (model && model.getValue() !== code.value) {
            model.setValue(code.value);
            setYText(code.value);
        }
    }
    ytext.observe(yObserver);
    disposeYToLocal = () => ytext.unobserve(yObserver);
    // If backend already loaded code.value, sync it once
    if (editorRef && code.value) {
        const m = editorRef.getModel?.();
        if (m && m.getValue() !== code.value) {
            m.setValue(code.value);
            setYText(code.value);
        }
    }

    // ── 4) FOLLOW THE CARET: update UI state + put a single "+" in the gutter ──
    function updateCaretUI(lineNumber: number | null) {
        newLine.value = lineNumber ?? null; // this drives your "caret line" text
        // Replace previous decoration with a single full-line decoration on caret
        // NOTE: the '+' itself is rendered by CSS (.cmt-plus::before)
        caretDecorationIds = editorRef.deltaDecorations(caretDecorationIds, lineNumber
            ? [{
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    glyphMarginClassName: 'cmt-plus',
                    glyphMarginHoverMessage: { value: 'Add comment' },
                },
            }] : []
        );
    }

    // On mount, set initial caret + decoration
    const pos = editorRef.getPosition?.();
    updateCaretUI(pos?.lineNumber ?? 1);

    // Whenever caret moves, update the single decoration and the `newLine` ref
    const cursorSub = editorRef.onDidChangeCursorPosition((e: any) => {
        updateCaretUI(e.position?.lineNumber ?? null);
    });
    disposeCursorListener = () => cursorSub.dispose();

    // OPEN INLINE WIDGET: click ANYWHERE ON A LINE (content or gutter)
    editorRef.onMouseDown((e: any) => {
        const p = e.target?.position;
        const t = e.target?.type;
        if (!p?.lineNumber) return;

        const clickedRangeBar =
            t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
            t === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS;

        if (clickedRangeBar) {
    // verify the actual element is one of our stripes
    const el: HTMLElement | undefined = e.target?.element;
    if (el && el.classList?.contains('cmt-range')) {
      const hit = allComments.value.find(
        c => p.lineNumber >= c.lineStart && p.lineNumber <= c.lineEnd
      );
      if (hit) {
        document.getElementById(`cmt-${hit.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        return; // handled
      }
    }
    // if it wasn't our stripe, fall through and treat it like a normal click
  }


  // 2) Add-new on glyph margin or line numbers (or even content if you want)
  const clickedAddArea =
    t === monacoRef.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
    t === monacoRef.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

  if (clickedAddArea) {
    captureSelectionOrLine(p.lineNumber);
    showInlineWidgetAtLine(p.lineNumber);
    return;
  }
    });
}

// async function submitCommentFromDialog() {
//   if (!versionId || !pendingLine.value || !pendingBody.value.trim()) return;
//   try {
//     const payload = { line: pendingLine.value, body: pendingBody.value.trim() };
//     await api.post(`/projects/${projectId}/v/${versionId}/comments`, payload);
//     showCommentDialog.value = false;
//     pendingBody.value = '';
//     await fetchComments();
//     editorRef?.revealLineInCenter(pendingLine.value);
//   } catch (err) {
//     console.error(err);
//     errorMsg.value = 'Failed to add comment.';
//   }
// }

// // Tiny helper: set the input line to the caret's current line
// function useCaretLine() {
    //   if (!editorRef) return;
    //   // a safe call — basically a shorter, safer version of:
    //   // if (editorRef.getPosition) {
        //   //   const pos = editorRef.getPosition();
        //   // } else {
            //   //   const pos = undefined;
            //   // }
            //   const pos = editorRef.getPosition?.();
            //   const line = pos?.lineNumber ?? null;
            //   if (line && line > 0) newLine.value = line;
            // }
            
// Fetch all comments for this version
    async function fetchComments() {
        if (!versionId) return;
        errorMsg.value = '';
        isLoadingComments.value = true;
        try {
            const { data } = await api.get(`/projects/${projectId}/v/${versionId}/comments`);
            allComments.value = data;
            renderRangeDecorations();

        } catch (err) {
            console.error(err);
            errorMsg.value = 'Failed to fetch comments.';
        } finally {
            isLoadingComments.value = false;
        }
    }



function renderRangeDecorations() {
  if (!editorRef) return;
  const decos: any[] = [];

  // One small decoration PER line inside each comment's range.
  for (const c of allComments.value) {
    const start = Math.max(1, c.lineStart);
    const end   = Math.max(start, c.lineEnd);
    for (let ln = start; ln <= end; ln++) {
      decos.push({
        range: new monacoRef.Range(ln, 1, ln, 1),
        options: {
          isWholeLine: true,
          // this column is between glyph margin and code — perfect for a thin strip
          linesDecorationsClassName: `cmt-range`,
          // optional hover text:
          hoverMessage: { value: `Comment #${c.id}: lines ${c.lineStart}–${c.lineEnd}` },
          // tag the decoration with the comment id for hit-testing
          description: `comment-${c.id}`,
        },
      });
    }
  }

  rangeDecorationIds = editorRef.deltaDecorations(rangeDecorationIds, decos);
}
// // function renderRangeDecorations() {
// //   if (!editorRef) return;
// //   const decos: any[] = [];

// //   // One small decoration PER line inside each comment's range.
// //   for (const c of allComments.value) {
// //     const start = Math.max(1, c.lineStart);
// //     const end   = Math.max(start, c.lineEnd);
// //     for (let ln = start; ln <= end; ln++) {
// //       decos.push({
// //         range: new monacoRef.Range(ln, 1, ln, 1),
// //         options: {
// //           isWholeLine: true,
// //           // this column is between glyph margin and code — perfect for a thin strip
// //           linesDecorationsClassName: `cmt-range`,
// //           // optional hover text:
// //           hoverMessage: { value: `Comment #${c.id}: lines ${c.lineStart}–${c.lineEnd}` },
// //           // tag the decoration with the comment id for hit-testing
// //           description: `comment-${c.id}`,
// //         },
// //       });
// //     }
// //   }

// //   rangeDecorationIds = editorRef.deltaDecorations(rangeDecorationIds, decos);
// // }

// Submit a new comment using explicit line number
    async function submitComment() {
        if (!canSubmit.value) return;
        isPosting.value = true;
        errorMsg.value = '';
        try {
            // backend maps body -> content
            const payload = { line: newLine.value, body: newBody.value.trim() }; 
            await api.post(`/projects/${projectId}/v/${versionId}/comments`, payload);
            newBody.value = '';
            // Keep the same line typed; or reset if you prefer:
            // newLine.value = null;
            await fetchComments();
        } catch (err) {
            console.error(err);
            errorMsg.value = 'Failed to post comment.';
        } finally {
            isPosting.value = false;
        }
    }

    function saveCurrent() {
        const text = editorRef?.getModel()?.getValue() ?? ''
        save(text); // this hits existing save(newContent?: string)  -- useVersion.ts
    }

// If no version in URL, resolve/create the first one and redirect
    onMounted(async () => {
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
                errorMsg.value = 'Could not resolve version.';
                console.error(error);
                return;
            }
        }
        await refresh();
        await fetchComments();
    });

    onBeforeUnmount(() => {
        closeInlineWidget();
        disposeCursorListener?.();
        disposeLocalToY?.();
        disposeYToLocal?.();
    });

// ──────────────────────────────────────────────────────────────
// watchEffect:
// In Vue’s reactivity system, `watchEffect` runs a function
// whenever *any* reactive values inside it change.
//
// In our project, we use it to “bridge” backend / Yjs state
// into the Monaco editor automatically.
//
// Example: if `code.value` (from the backend via useVersion)
// or `ytext` (shared Yjs text) updates, `watchEffect` notices
// and re-sets the Monaco model’s contents so the editor
// always reflects the latest code.
//
// Key points:
// • Runs immediately once, then re-runs whenever dependencies
//   (like `code.value`) change.
// • Automatically tracks what you touch inside the callback.
// • Great for small, reactive side-effects like syncing UI
//   components with data.
// ──────────────────────────────────────────────────────────────
    watchEffect(() => {
        // When refresh() sets code.value, reflect it in the editor + Yjs
        if (editorRef && code.value) {
                const model = editorRef.getModel?.();
                if (model && model.getValue() !== code.value) {
                    model.setValue(code.value);
                    setYText(code.value);
            }
        }
    });
</script>

<style>
    /* “+” sign in the gutter when hovering a line */
    .monaco-editor .cmt-plus::before {
        content: "+";
        display: inline-block;
        font-weight: 900;
        font-size: 16px;
        margin-left: 1rem;
        margin-bottom: 0.5rem;
        line-height: 14px;
        width: 14px;
        height: 14px;
        text-align: center;
        border-radius: 50%;
        /* border: 1px solid currentColor; */
        transform: translateY(1px);
        color: #ff0000;
    }
    /* Minimal inline bubble that Monaco positions beside the line */
    .mw-inline {
        background: #111827;        /* near vs-dark */
        color: #e5e7eb;
        border: 1px solid #374151;
        border-radius: 10px;
        padding: 8px;
        max-width: 560px;
        min-width: 460px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.35);
        font-size: 12px;
        margin-left: 55rem;
    }

    .mw-inline .mw-head {
    color: #9ca3af;
    margin-bottom: 6px;
    font-size: 11px;
    }

    .mw-inline .mw-input {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 56px;
    background: #0b1220;
    color: #e5e7eb;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 6px 8px;
    outline: none;
    }

    .mw-inline .mw-input:focus {
    border-color: #60a5fa;
    }

    .mw-inline .mw-actions {
    margin-top: 6px;
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    }

    .mw-inline .mw-btn {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #374151;
    background: #1f2937;
    color: #e5e7eb;
    cursor: pointer;
    }

    .mw-inline .mw-btn:hover {
    filter: brightness(1.1);
    }

    .mw-inline .mw-add {
    border-color: #2563eb;
    }

    /* slim vertical bar for commented ranges */
.monaco-editor .cmt-range {
  border-left: 3px solid #ff0000; /* blue-ish */
  margin-left: 12px;               /* a little breathing room */
}
</style>