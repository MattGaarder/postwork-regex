// src/lib/monacoComments.ts
import * as monaco from 'monaco-editor';

export function buildCommentDecorations(comments: { line: number }[]) {
  return comments.map((c) => ({
    range: new monaco.Range(c.line, 1, c.line, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: 'comment-glyph', // style via CSS ::before
      glyphMarginHoverMessage: { value: 'View comments on this line' },
    },
  }));
}

export function applyDecorations(editor: monaco.editor.IStandaloneCodeEditor, decorations: any[]) {
  const collection = editor.createDecorationsCollection([]);
  collection.set(decorations);
  return collection;
}

// /* Add a simple dot in the gutter; you can replace with an icon */
// .comment-glyph {
//   background: transparent;
// }
// .comment-glyph::before {
//   content: '●';
//   font-size: 12px;
//   line-height: 1;
// }