import { describe, expect, it } from 'vitest'
import { formatModuleIdentifier } from './format'

describe('formatModuleIdentifier', () => {
  it('removes internal sidecar query metadata from display labels', () => {
    expect(formatModuleIdentifier(
      'components/ui/VSelect.vue?raw&weapp-vite-sidecar-owner=%2FUsers%2Fdeveloper%2Fproject%2Fsrc%2Fcomponents%2Fui%2FVSelect.vue&weapp-vite-sidecar=using-component&lang.js',
    )).toBe('components/ui/VSelect.vue')
  })

  it('normalizes virtual and Windows module identifiers', () => {
    expect(formatModuleIdentifier('\0C:\\project\\src\\entry.ts?lang.ts')).toBe('C:/project/src/entry.ts')
  })
})
