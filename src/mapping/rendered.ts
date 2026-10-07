import { HtmlParser, Element, Text, getHtmlTagDefinition, type Node } from '@angular/compiler';

export interface RenderedNode {
  tag: string;
  attrs: Map<string, string>;
  /** Normalized text content, or null when the snippet is truncated or malformed. */
  text: string | null;
}

function collect(nodes: readonly Node[]): string {
  let out = '';
  for (const n of nodes) {
    if (n instanceof Text) out += n.value;
    else if (n instanceof Element) out += collect(n.children);
  }
  return out;
}

/** Parses the failing node's HTML as reported by axe. Returns null if it has no element. */
export function parseRendered(html: string): RenderedNode | null {
  const parsed = new HtmlParser().parse(html, 'violation.html', { tokenizeExpansionForms: false });
  const el = parsed.rootNodes.find((n): n is Element => n instanceof Element);
  if (!el) return null;

  const attrs = new Map<string, string>();
  for (const a of el.attrs) attrs.set(a.name.toLowerCase(), a.value);

  // Axe shortens long snippets (often to the opening tag only), so text is trusted only for complete markup.
  const tag = el.name.toLowerCase();
  const closed = getHtmlTagDefinition(tag).isVoid || new RegExp(`</${tag}\\s*>\\s*$`, 'i').test(html.trim());
  const reliable = parsed.errors.length === 0 && !html.includes(' ...') && closed;
  return {
    tag,
    attrs,
    text: reliable ? collect(el.children).replace(/\s+/g, ' ').trim() : null,
  };
}

/** Fallback for files without hostChain: custom-element ancestors named in the selector, nearest first. */
export function selectorChain(selector: string): string[] {
  const cleaned = selector.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  const compounds = cleaned.split(/[\s>+~]+/).filter(Boolean);
  // The last compound is the failing node itself, not an ancestor.
  return compounds
    .slice(0, -1)
    .map((c) => /^[a-zA-Z][\w-]*/.exec(c)?.[0]?.toLowerCase())
    .filter((t): t is string => t !== undefined && t.includes('-'))
    .reverse();
}
