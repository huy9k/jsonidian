import type { ParsedNote } from "./types.js";
import { isImageTarget } from "./resolve.js";

/** Wikilink / embed: optional !, target, optional #fragment, optional |alias */
const WIKI_RE =
  /(!)?\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/g;

/**
 * Expand `![[note]]` embeds into the target note body (images left for mdian).
 * Skips unpublished targets; respects maxDepth.
 */
export function expandNoteEmbeds(
  body: string,
  resolveTarget: (raw: string) => ParsedNote | undefined,
  maxDepth: number,
  depth = 0,
  stack: Set<string> = new Set(),
): string {
  if (depth >= maxDepth) return body;

  return body.replace(WIKI_RE, (full, bang, rawTarget, _fragment, _alias) => {
    if (!bang) return full;
    const target = String(rawTarget).trim();
    if (isImageTarget(target)) return full;

    const note = resolveTarget(target);
    if (!note || !note.published) return full;
    if (stack.has(note.slug)) return full;

    const nextStack = new Set(stack);
    nextStack.add(note.slug);
    const expanded = expandNoteEmbeds(
      note.body,
      resolveTarget,
      maxDepth,
      depth + 1,
      nextStack,
    );
    return `\n\n${expanded}\n\n`;
  });
}

/**
 * Collect outbound wikilink targets (non-embed) from markdown body.
 */
export function collectWikilinkTargets(body: string): string[] {
  const targets: string[] = [];
  const re = new RegExp(WIKI_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const isEmbed = Boolean(match[1]);
    const target = match[2]?.trim();
    if (!target || isEmbed) continue;
    if (isImageTarget(target)) continue;
    targets.push(target);
  }
  return targets;
}
