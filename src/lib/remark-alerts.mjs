// Turns GitHub-style alerts (> [!NOTE], > [!TIP], > [!WARNING], ...) into
// <blockquote class="callout callout-note" data-callout="Note"> elements.
const KINDS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

function walk(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) walk(child, fn);
}

export function remarkAlerts() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      const para = node.children?.[0];
      const text = para?.type === 'paragraph' ? para.children?.[0] : null;
      if (!text || text.type !== 'text') return;
      const match = text.value.match(MARKER);
      if (!match) return;

      const kind = match[1];
      text.value = text.value.slice(match[0].length).replace(/^\n/, '');
      if (!text.value) para.children.shift();
      // The marker sat on its own line: drop the leading line break.
      if (para.children[0]?.type === 'break') para.children.shift();
      if (para.children.length === 0) node.children.shift();

      node.data ??= {};
      node.data.hProperties = {
        className: ['callout', `callout-${kind.toLowerCase()}`],
        'data-callout': KINDS[kind],
      };
    });
  };
}
