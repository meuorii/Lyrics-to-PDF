import type { MeasuredTextLine } from './text-layout';

export type PaginationItem =
  | { kind: 'line'; line: MeasuredTextLine }
  | { kind: 'blank'; heightPt: number }
  | { kind: 'section'; label: MeasuredTextLine[]; firstLine?: MeasuredTextLine; separationPt: number };

/** usedHeightPt is the visual cursor; requiredHeightPt tracks the highest safe renderer extent. */
export type PaginatedColumn = { items: PaginationItem[]; usedHeightPt: number; requiredHeightPt: number };
export type PaginatedPage = { columns: [PaginatedColumn, PaginatedColumn] };

function visualHeight(item: PaginationItem): number {
  if (item.kind === 'line') return item.line.heightPt;
  if (item.kind === 'blank') return item.heightPt;
  return item.label.reduce((height, line) => height + line.heightPt, 0) + (item.firstLine?.heightPt ?? 0);
}

function requiredEnd(item: PaginationItem, startPt: number): number {
  if (item.kind === 'blank') return startPt + item.heightPt;
  const lines = item.kind === 'line' ? [item.line] : [...item.label, ...(item.firstLine ? [item.firstLine] : [])];
  let cursor = startPt;
  let required = startPt;
  for (const line of lines) {
    required = Math.max(required, cursor + line.paginationHeightPt);
    cursor += line.heightPt;
  }
  return required;
}

function emptyColumn(): PaginatedColumn {
  return { items: [], usedHeightPt: 0, requiredHeightPt: 0 };
}

export function paginateLayout(items: PaginationItem[], columnHeightPt: number, columnsPerPage = 2): PaginatedPage[] {
  if (!(columnHeightPt > 0) || columnsPerPage !== 2) throw new RangeError('PDF pagination requires positive height and two columns.');
  const columns: PaginatedColumn[] = [emptyColumn()];
  let columnIndex = 0;
  const current = () => columns[columnIndex]!;
  const advance = () => {
    columnIndex += 1;
    if (!columns[columnIndex]) columns.push(emptyColumn());
  };
  const fits = (item: PaginationItem, startPt = current().usedHeightPt) => requiredEnd(item, startPt) <= columnHeightPt + 0.001;
  const add = (item: PaginationItem) => {
    const column = current();
    column.requiredHeightPt = Math.max(column.requiredHeightPt, requiredEnd(item, column.usedHeightPt));
    column.items.push(item);
    column.usedHeightPt += visualHeight(item);
  };
  const hasVisibleContent = () => current().items.some((item) => item.kind !== 'blank');

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.kind === 'blank') {
      if (!hasVisibleContent()) continue;
      const next = items.slice(index + 1).find((candidate) => candidate.kind !== 'blank');
      if (!next) continue;
      const separation = next.kind === 'section' && hasVisibleContent() ? next.separationPt : 0;
      if (!fits(item) || !fits(next, current().usedHeightPt + item.heightPt + separation)) {
        advance();
        continue;
      }
      add(item);
      continue;
    }

    const sectionSeparation = item.kind === 'section' && hasVisibleContent() ? item.separationPt : 0;
    const startPt = current().usedHeightPt + sectionSeparation;
    if (!fits(item, startPt)) {
      advance();
      if (!fits(item, 0)) throw new RangeError('A section keep-with-first-line group cannot fit in an empty column.');
      add(item);
      continue;
    }
    if (sectionSeparation > 0) add({ kind: 'blank', heightPt: sectionSeparation });
    add(item);
  }

  const pages: PaginatedPage[] = [];
  for (let index = 0; index < columns.length; index += 2) {
    pages.push({ columns: [columns[index]!, columns[index + 1] ?? emptyColumn()] });
  }
  return pages;
}
