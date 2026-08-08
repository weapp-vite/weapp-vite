export const PICKER_MODES = ['selector', 'multiSelector', 'time', 'date', 'region'] as const

export type PickerMode = typeof PICKER_MODES[number]

export interface PickerOption {
  label: string
  value: unknown
}

export function resolvePickerMode(value: string | null | undefined): PickerMode {
  return PICKER_MODES.includes(value as PickerMode) ? value as PickerMode : 'selector'
}

function resolvePickerLabel(value: unknown, rangeKey?: string) {
  if (rangeKey && value && typeof value === 'object') {
    const label = (value as Record<string, unknown>)[rangeKey]
    return label === undefined || label === null ? '' : String(label)
  }
  return value === undefined || value === null ? '' : String(value)
}

function normalizeRange(value: unknown) {
  return Array.isArray(value) ? value : []
}

export function resolvePickerColumns(
  range: unknown,
  mode: PickerMode,
  rangeKey?: string,
): PickerOption[][] {
  if (mode === 'multiSelector') {
    return normalizeRange(range).map((column) => {
      return normalizeRange(column).map(value => ({
        label: resolvePickerLabel(value, rangeKey),
        value,
      }))
    })
  }
  if (mode !== 'selector') {
    return []
  }
  return [normalizeRange(range).map(value => ({
    label: resolvePickerLabel(value, rangeKey),
    value,
  }))]
}

export function normalizePickerIndex(value: unknown, itemCount: number) {
  const numeric = Number(value)
  const index = Number.isFinite(numeric) ? Math.trunc(numeric) : 0
  return Math.min(Math.max(0, index), Math.max(0, itemCount - 1))
}

export function normalizePickerIndexes(value: unknown, columnLengths: number[]) {
  const indexes = Array.isArray(value) ? value : []
  return columnLengths.map((length, column) => normalizePickerIndex(indexes[column], length))
}

export function createPickerChangeDetail(mode: PickerMode, value: unknown) {
  if (mode === 'region') {
    const region = Array.isArray(value) ? value.map(item => String(item ?? '')) : []
    return {
      value: region,
      code: region.map(() => ''),
      postcode: '',
    }
  }
  return { value }
}
