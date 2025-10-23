// src/composables/useYDoc.ts
import { ref, onBeforeUnmount } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

/**
 * useYDoc
 * A tiny helper that:
 *  1) creates a Yjs Doc (in-memory CRDT)
 *  2) connects it to a y-websocket server via WebsocketProvider
 *  3) exposes a reactive 'status' ("connecting" | "connected" | "disconnected")
 *  4) auto-cleans up when the *component* that uses it is destroyed
 *
 * IMPORTANT: This composable is meant to be called inside <script setup> / setup().
 * Vue will call our cleanup (onBeforeUnmount) only when the component unmounts.
 */
export function useYDoc(roomId: string, wsUrl = 'ws://localhost:1234') {
  // 1) Create a shared Y.Doc for this component instance.
  //    Everything you put into this doc (e.g., Y.Text, Y.Map) can sync.
  const doc = new Y.Doc();

  // 2) Track websocket connection status as reactive state for the UI.
  const status = ref<'connecting' | 'connected' | 'disconnected'>('connecting');
  // 3) Connect the doc to the y-websocket server; 'roomId' determines who syncs together.
  //    All clients using the same (wsUrl, roomId) will exchange updates.
  //    The provider immediately tries to connect (can be disabled with opts if you prefer).
  const provider = new WebsocketProvider(wsUrl, roomId, doc);
  // 4) Mirror provider connection status into our reactive ref for convenience.
  provider.on('status', (e: { status: 'connected' | 'disconnected' }) => {
    status.value = e.status;
  })
  // 5) Cleanup: when the component UN-mounts, close the socket and free the Y.Doc.
  //    This prevents leaked connections during route changes / hot reloads.
  onBeforeUnmount(() => {
    // Stop networking + event handlers for this provider
    provider.destroy();
    // Free the underlying Doc (and its data structures)
    doc.destroy();
  })

  return { doc, provider, status }
}