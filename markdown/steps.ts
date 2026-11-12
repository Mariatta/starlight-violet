/**
 * Steps, rendered like Starlight's `<Steps>` component, in plain Markdown.
 *
 * - `:::steps` around an ordered list makes it steps, for any page.
 * - A run of step items, each a list item that starts with bold "Step N:"
 *   (`- [ ] **Step 1: Write the failing test**`), becomes steps on its own:
 *   the blocks between one step item and the next (code, "Run:" lines) move
 *   into that step. The run ends at a heading, a thematic break or the end of
 *   the section. This is how agent-written plans lay out a task's steps.
 *
 * The markup is Starlight's (`<ol class="sl-steps" role="list">`); its styles
 * are in Violet's CSS, since Starlight loads them only with the component.
 */
import type { MdastPluginEntry } from 'satteri';
import type { List, ListItem, Paragraph, RootContent, Strong, Text } from 'mdast';

const STEP = /^Step\s+(\d+)\s*[:.]\s*/i;

function stepsList(items: ListItem[], start: number): List {
  return {
    type: 'list',
    ordered: true,
    start,
    spread: true,
    children: items,
    data: {
      hProperties: { className: ['sl-steps'], role: 'list', ...(start > 1 && { style: `--sl-steps-start: ${start - 1}` }) },
    },
  } as List;
}

/** The number and the item, with "Step N:" taken off its bold title, when `item` is a step item. */
function stepItem(item: ListItem): { number: number; item: ListItem } | undefined {
  const first = item.children[0];
  if (first?.type !== 'paragraph') return;
  const strong = first.children[0];
  if (strong?.type !== 'strong') return;
  const text = strong.children[0];
  if (text?.type !== 'text') return;
  const match = STEP.exec(text.value);
  if (!match) return;
  const title: Strong = { ...strong, children: [{ type: 'text', value: text.value.slice(match[0].length) } as Text, ...strong.children.slice(1)] };
  const paragraph: Paragraph = { ...first, children: [title, ...first.children.slice(1)] };
  return {
    number: Number(match[1]),
    item: { type: 'listItem', spread: true, checked: null, children: [paragraph, ...item.children.slice(1)] } as ListItem,
  };
}

/**
 * A bulleted list's trailing step items, and the items before them. Markdown
 * joins a step item to a list right above it ("- Produces: ..." then
 * "- [ ] **Step 1: ...**"), so the steps can start part way down a list.
 */
function splitSteps(node: RootContent): { before: ListItem[]; steps: { number: number; item: ListItem }[] } | undefined {
  if (node.type !== 'list' || node.ordered) return;
  const steps: { number: number; item: ListItem }[] = [];
  let index = node.children.length;
  while (index > 0) {
    const step = stepItem(node.children[index - 1]);
    if (!step) break;
    steps.unshift(step);
    index -= 1;
  }
  if (steps.length === 0) return;
  return { before: node.children.slice(0, index), steps };
}

/** The children with each run of step items made into one steps list; undefined when there is none. */
function withSteps(children: readonly RootContent[]): RootContent[] | undefined {
  const out: RootContent[] = [];
  let run: { start: number; items: ListItem[] } | undefined;
  let changed = false;
  const close = () => {
    if (run) out.push(stepsList(run.items, run.start));
    run = undefined;
  };
  for (const node of children) {
    const split = splitSteps(node);
    if (split) {
      if (split.before.length > 0) {
        close();
        out.push({ ...(node as List), children: split.before });
      }
      for (const step of split.steps) {
        // "Step 1" again is the next task's steps, with no heading between.
        if (run && step.number <= run.start + run.items.length - 1) close();
        if (!run) run = { start: step.number, items: [] };
        run.items.push(step.item);
      }
      changed = true;
    } else if (run && node.type !== 'heading' && node.type !== 'thematicBreak') {
      run.items.at(-1)!.children.push(node as ListItem['children'][number]);
    } else {
      close();
      out.push(node);
    }
  }
  close();
  return changed ? out : undefined;
}

export function stepsPlugin(): MdastPluginEntry {
  return () => ({
    name: 'notes-steps',
    before(root, ctx) {
      const children = withSteps(root.children as RootContent[]);
      if (children) ctx.replaceNode(root, { type: 'root', children } as never);
    },
    containerDirective(node, ctx) {
      if (node.name !== 'steps') return;
      const lists = node.children.filter((child) => child.type === 'list');
      if (lists.length !== 1 || node.children.length !== 1 || !(lists[0] as List).ordered) {
        throw new Error(`${ctx.fileURL?.pathname ?? 'a page'}: :::steps must hold exactly one numbered list`);
      }
      const list = lists[0] as List;
      ctx.replaceNode(node, stepsList(list.children, list.start ?? 1));
    },
  });
}
