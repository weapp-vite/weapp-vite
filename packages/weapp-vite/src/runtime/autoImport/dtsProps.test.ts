import { describe, expect, it } from 'vitest'
import { extractComponentPropsFromDts, extractInlinePropsTypeFromCode } from './dtsProps'

describe('component prop type extraction', () => {
  it('extracts defineProps type literal members from TypeScript source', () => {
    const result = extractInlinePropsTypeFromCode(`
defineProps<{
  sidebar?: boolean
  title?: string
}>()
    `.trim())

    expect([...result.entries()]).toEqual([
      ['sidebar', 'boolean'],
      ['title', 'string'],
    ])
  })

  it('inlines local prop types and qualifies portable imported types', () => {
    const result = extractInlinePropsTypeFromCode(`
import type { ImportedFilter as RemoteFilter } from '@fixtures/filter-types'
import type { RelativeFilter } from './relative-filter'

defineProps<{
  filters?: FilterItem[]
  remote?: RemoteFilter
  relative?: RelativeFilter
  missing?: MissingFilter
  hostEvent?: WechatMiniprogram.ButtonGetPhoneNumber
  nodeTimer?: NodeJS.Timeout
  poison?: toString
}>()

interface FilterItem {
  value: string
  label: string
  count?: number
}
    `.trim())

    expect(result.get('filters')).not.toContain('FilterItem')
    expect(result.get('filters')).toContain('value: string')
    expect(result.get('filters')).toContain('label: string')
    expect(result.get('remote')).toBe('import(\"@fixtures/filter-types\").ImportedFilter')
    expect(result.get('relative')).toBe('unknown')
    expect(result.get('missing')).toBe('unknown')
    expect(result.get('hostEvent')).toBe('unknown')
    expect(result.get('nodeTimer')).toBe('unknown')
    expect(result.get('poison')).toBe('unknown')
  })

  it('keeps declaration prop values portable', () => {
    const result = extractComponentPropsFromDts(`
import type { ImportedFilter as RemoteFilter } from '@fixtures/filter-types'
import type { RelativeFilter } from './relative-filter'

interface FilterItem {
  value: string
}

interface FilterBarComponent {
  properties: {
    filters: { value: FilterItem[] }
    remote: { value: RemoteFilter }
    relative: { value: RelativeFilter }
  }
}
    `.trim())

    expect(result.get('filters')).not.toContain('FilterItem')
    expect(result.get('filters')).toContain('value: string')
    expect(result.get('remote')).toBe('import(\"@fixtures/filter-types\").ImportedFilter')
    expect(result.get('relative')).toBe('unknown')
  })
})
