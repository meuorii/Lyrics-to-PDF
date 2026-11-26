import type { MeasuredTextLine } from './text-layout';

export type PaginationItem =
  | { kind: 'line'; line: MeasuredTextLine }
  | { kind: 'blank'; heightPt: number }
  | { kind: 'section'; label: MeasuredTextLine[]; firstLine?: MeasuredTextLine; separationPt: number };

export type PaginatedColumn = { items: PaginationItem[]; usedHeightPt: number };
export type PaginatedPage = { columns: [PaginatedColumn, PaginatedColumn] };

function itemHeight(item: PaginationItem): number {
  if (item.kind === 'line') return item.line.heightPt;
  if (item.kind === 'blank') return item.heightPt;
  return item.label.reduce((height, line) => height + line.heightPt, 0) + (item.firstLine?.heightPt ?? 0);
}

function emptyColumn(): PaginatedColumn {
  return { items: [], usedHeightPt: 0 };
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
  const fits = (height: number) => current().usedHeightPt + height <= columnHeightPt + 0.001;
  const add = (item: PaginationItem) => {
    current().items.push(item);
    current().usedHeightPt += itemHeight(item);
  };
  const hasVisibleContent = () => current().items.some((item) => item.kind !== 'blank');

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.kind === 'blank') {
      if (!hasVisibleContent()) continue;
      const next = items.slice(index + 1).find((candidate) => candidate.kind !== 'blank');
      if (!next) continue;
      const requiredNext = itemHeight(next) + (next.kind === 'section' && hasVisibleContent() ? next.separationPt : 0);
      if (!fits(item.heightPt + requiredNext)) {
        advance();
        continue;
      }
      add(item);
      continue;
    }

    const groupHeight = itemHeight(item);
    if (groupHeight > columnHeightPt + 0.001) throw new RangeError('A section keep-with-first-line group cannot fit in an empty column.');
    const separation = item.kind === 'section' && hasVisibleContent() ? item.separationPt : 0;
    if (!fits(separation + groupHeight)) {
      advance();
    } else if (separation > 0) {
      add({ kind: 'blank', heightPt: separation });
    }
    add(item);
  }

  const pages: PaginatedPage[] = [];
  for (let index = 0; index < columns.length; index += 2) {
    pages.push({
      columns: [columns[index]!, columns[index + 1] ?? emptyColumn()],
    });
  }
  return pages;
}
