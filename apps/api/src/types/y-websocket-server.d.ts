// types/y-websocket-utils.d.ts
declare module 'y-websocket/bin/utils.js' {
  import { IncomingMessage } from 'http'
  import { WebSocket } from 'ws'

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    options?: {
      // You can extend this gradually as needed:
      // docName?: string
      // pingTimeout?: number
      // etc.
      [key: string]: any
    }
  ): void
}