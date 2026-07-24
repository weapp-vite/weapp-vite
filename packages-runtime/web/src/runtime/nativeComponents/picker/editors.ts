import type { PickerMode } from './helpers'
import {
  normalizePickerIndex,
  normalizePickerIndexes,
  resolvePickerColumns,
} from './helpers'

interface PickerEditorOptions {
  mode: PickerMode
  range: unknown
  rangeKey?: string
  value: unknown
  fields?: string
  start?: string
  end?: string
  customItem?: string
  level?: string
  onValueChange: (value: unknown) => void
  onColumnChange: (column: number, value: number) => void
}

export function currentDateValue(fields?: string) {
  const date = new Date()
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (fields === 'year') {
    return year
  }
  if (fields === 'month') {
    return `${year}-${month}`
  }
  return `${year}-${month}-${day}`
}

function renderRangeEditors(options: PickerEditorOptions) {
  const columns = resolvePickerColumns(options.range, options.mode, options.rangeKey)
  const current = options.mode === 'multiSelector'
    ? normalizePickerIndexes(options.value, columns.map(column => column.length))
    : [normalizePickerIndex(options.value, columns[0]?.length ?? 0)]
  return columns.map((column, columnIndex) => {
    const select = document.createElement('select')
    select.size = Math.min(7, Math.max(3, column.length))
    column.forEach((option, optionIndex) => {
      const item = document.createElement('option')
      item.value = String(optionIndex)
      item.textContent = option.label
      item.selected = optionIndex === current[columnIndex]
      select.append(item)
    })
    select.addEventListener('change', () => {
      const index = normalizePickerIndex(select.value, column.length)
      if (options.mode === 'multiSelector') {
        const next = normalizePickerIndexes(options.value, columns.map(item => item.length))
        next[columnIndex] = index
        options.value = next
        options.onValueChange(next)
        options.onColumnChange(columnIndex, index)
      }
      else {
        options.value = index
        options.onValueChange(index)
      }
    })
    return select
  })
}

function renderTemporalEditor(options: PickerEditorOptions) {
  const input = document.createElement('input')
  input.type = options.mode === 'time'
    ? 'time'
    : options.fields === 'month'
      ? 'month'
      : options.fields === 'year'
        ? 'number'
        : 'date'
  input.value = String(options.value ?? '')
  if (options.fields === 'year') {
    input.value = input.value.slice(0, 4)
  }
  if (options.start) {
    input.min = options.fields === 'year' ? options.start.slice(0, 4) : options.start
  }
  if (options.end) {
    input.max = options.fields === 'year' ? options.end.slice(0, 4) : options.end
  }
  input.addEventListener('input', () => options.onValueChange(input.value))
  return input
}

function renderRegionEditors(options: PickerEditorOptions) {
  const count = options.level === 'province' ? 1 : options.level === 'city' ? 2 : options.level === 'sub-district' ? 4 : 3
  const values = Array.isArray(options.value) ? [...options.value] : []
  return Array.from({ length: count }, (_, index) => {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = String(values[index] ?? options.customItem ?? '')
    input.addEventListener('input', () => {
      values[index] = input.value
      options.onValueChange([...values])
    })
    return input
  })
}

export function renderPickerEditors(options: PickerEditorOptions) {
  if (options.mode === 'selector' || options.mode === 'multiSelector') {
    return renderRangeEditors(options)
  }
  if (options.mode === 'date' || options.mode === 'time') {
    return [renderTemporalEditor(options)]
  }
  return renderRegionEditors(options)
}
