export const PICKER_VIEW_COLUMN_CHANGE_EVENT = 'weapp-picker-view-column-change'
export const PICKER_VIEW_COLUMN_READY_EVENT = 'weapp-picker-view-column-ready'
export const PICKER_VIEW_PICK_START_EVENT = 'weapp-picker-view-pick-start'
export const PICKER_VIEW_PICK_END_EVENT = 'weapp-picker-view-pick-end'

export interface PickerViewColumnChangeDetail {
  value: number
  phase: 'changing' | 'end'
}

function normalizeColumnIndex(value: unknown, itemCount: number) {
  const numeric = Number(value)
  const index = Number.isFinite(numeric) ? Math.trunc(numeric) : 0
  return Math.min(Math.max(0, index), Math.max(0, itemCount - 1))
}

export function normalizePickerViewValue(value: unknown, columnLengths: number[]) {
  const indexes = Array.isArray(value) ? value : []
  return columnLengths.map((length, column) => normalizeColumnIndex(indexes[column], length))
}
