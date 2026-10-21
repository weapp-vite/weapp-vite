import type { SelectionMode } from './types.ts'

/** 首轮仅观测缩选；单独启用经过回归验证的 affected 策略。 */
export const DEFAULT_SELECTION: SelectionMode = 'shadow'
