// ---------------------------------------------------------------------------
// Cross-page selection state machine (implementation plan §9).
//
// - mode 'ids': a deliberate small selection of specific rows (the API caps
//   this at 2,000). Survives pagination.
// - mode 'filter': "select all N matching this filter" — the payload is the
//   filter object, never the IDs; unchecking a row lands in excludeIds.
// - Any filter/sort/search change clears the selection entirely: a selection
//   made under one filter must never silently apply under a different one.
// ---------------------------------------------------------------------------

export type QueueSelection =
  | { mode: 'ids'; ids: ReadonlySet<number> }
  | { mode: 'filter'; excludeIds: ReadonlySet<number> }
  | null;

export function toggleRow(sel: QueueSelection, id: number): QueueSelection {
  if (!sel) return { mode: 'ids', ids: new Set([id]) };
  if (sel.mode === 'ids') {
    const ids = new Set(sel.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return ids.size ? { mode: 'ids', ids } : null;
  }
  const excludeIds = new Set(sel.excludeIds);
  if (excludeIds.has(id)) excludeIds.delete(id);
  else excludeIds.add(id);
  return { mode: 'filter', excludeIds };
}

export function togglePage(sel: QueueSelection, pageIds: number[]): QueueSelection {
  const allSelected = pageIds.length > 0 && pageIds.every((id) => isRowSelected(sel, id));
  if (!sel || sel.mode === 'ids') {
    const ids = new Set(sel?.mode === 'ids' ? sel.ids : []);
    for (const id of pageIds) {
      if (allSelected) ids.delete(id);
      else ids.add(id);
    }
    return ids.size ? { mode: 'ids', ids } : null;
  }
  const excludeIds = new Set(sel.excludeIds);
  for (const id of pageIds) {
    if (allSelected) excludeIds.add(id);
    else excludeIds.delete(id);
  }
  return { mode: 'filter', excludeIds };
}

export function escalateToFilter(_sel: QueueSelection): QueueSelection {
  return { mode: 'filter', excludeIds: new Set() };
}

export function isRowSelected(sel: QueueSelection, id: number): boolean {
  if (!sel) return false;
  if (sel.mode === 'ids') return sel.ids.has(id);
  return !sel.excludeIds.has(id);
}

export function isPageFullySelected(sel: QueueSelection, pageIds: number[]): boolean {
  return pageIds.length > 0 && pageIds.every((id) => isRowSelected(sel, id));
}

export function selectionCount(sel: QueueSelection, total: number): number {
  if (!sel) return 0;
  if (sel.mode === 'ids') return sel.ids.size;
  return Math.max(0, total - sel.excludeIds.size);
}

// Header checkbox state: true / false / 'indeterminate' (some page rows).
export function pageCheckboxState(sel: QueueSelection, pageIds: number[]): boolean | 'indeterminate' {
  const selected = pageIds.filter((id) => isRowSelected(sel, id)).length;
  if (selected === 0) return false;
  if (selected === pageIds.length) return true;
  return 'indeterminate';
}
