import { describe, expect, it } from 'vitest';
import {
  escalateToFilter,
  isPageFullySelected,
  isRowSelected,
  pageCheckboxState,
  selectionCount,
  togglePage,
  toggleRow,
  type QueueSelection,
} from './selection';

// Stretch test (implementation plan §11 #5): selection survives pagination —
// the state machine holds page-1 selections while browsing page 2, and a
// filter change clears everything.
describe('queue selection state machine', () => {
  const page1 = [1, 2, 3];
  const page2 = [4, 5, 6];

  it('selection made on page 1 survives browsing to page 2', () => {
    let sel: QueueSelection = null;
    sel = toggleRow(sel, 1);
    sel = toggleRow(sel, 2);
    // "Navigate to page 2": the state holds ids 1,2 while page 2 renders.
    expect(selectionCount(sel, 100)).toBe(2);
    expect(isRowSelected(sel, 1)).toBe(true);
    expect(isRowSelected(sel, 4)).toBe(false);
    sel = toggleRow(sel, 5);
    expect(selectionCount(sel, 100)).toBe(3);
  });

  it('clearing (the filter-change path) empties the selection', () => {
    let sel: QueueSelection = null;
    sel = toggleRow(sel, 1);
    sel = null; // what the Queue page does on any filter/sort/search change
    expect(selectionCount(sel, 100)).toBe(0);
  });

  it('page toggle selects and unselects a whole page in ids mode', () => {
    let sel = togglePage(null, page1);
    expect(selectionCount(sel, 100)).toBe(3);
    expect(isPageFullySelected(sel, page1)).toBe(true);
    sel = togglePage(sel, page1);
    expect(sel).toBeNull();
  });

  it('filter mode counts total minus exclusions and tracks excluded rows', () => {
    let sel: QueueSelection = null;
    sel = togglePage(sel, page1);
    sel = escalateToFilter(sel);
    expect(selectionCount(sel, 1000)).toBe(1000);
    // Uncheck one row after escalating — stays in filter mode via excludeIds.
    sel = toggleRow(sel, 2);
    expect(sel?.mode).toBe('filter');
    expect(selectionCount(sel, 1000)).toBe(999);
    expect(isRowSelected(sel, 2)).toBe(false);
    expect(isRowSelected(sel, 3)).toBe(true);
    // Re-checking the row removes the exclusion.
    sel = toggleRow(sel, 2);
    expect(selectionCount(sel, 1000)).toBe(1000);
  });

  it('header checkbox reflects partial page selection', () => {
    let sel: QueueSelection = { mode: 'ids', ids: new Set([1]) };
    expect(pageCheckboxState(sel, page1)).toBe('indeterminate');
    expect(pageCheckboxState(sel, page2)).toBe(false);
    sel = togglePage(sel, page1);
    expect(pageCheckboxState(sel, page1)).toBe(true);
  });
});
