import { EmptyRow, GzTable, Row, SortHeader } from './table';
import { Pager } from './pager';
import { StageLinks } from './stage-links';
import { Cell } from '../components/missing';

export * from './sort';
export { EmptyRow, GzTable, Row, SortHeader } from './table';
export { Pager } from './pager';
export { StageLinks, type StageLink } from './stage-links';

/** Everything a register template needs: `imports: [...TABLE_KIT]`. */
export const TABLE_KIT = [GzTable, Row, SortHeader, EmptyRow, Cell, Pager, StageLinks] as const;
