import type { SelectionMode } from './types.ts'

/** 默认使用已审计的影响范围；未知输入仍保守扩大，shadow 可显式观测。 */
export const DEFAULT_SELECTION: SelectionMode = 'affected'
