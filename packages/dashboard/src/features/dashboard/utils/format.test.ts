import { describe, expect, it } from 'vitest'
import { formatModuleIdentifier } from './format'

describe('formatModuleIdentifier', () => {
  it('removes internal sidecar query metadata from display labels', () => {
    expect(formatModuleIdentifier(
      'components/ui/VSelect.vue?raw&weapp-vite-sidecar-owner=%2FUsers%2Fdeveloper%2Fproject%2Fsrc%2Fcomponents%2Fui%2FVSelect.vue&weapp-vite-sidecar=using-component&lang.js',
    )).toBe('components/ui/VSelect.vue')
  })

  it('normalizes installed and workspace package identities', () => {
    expect(formatModuleIdentifier(
      '../../node_modules/.pnpm/wevu@6.23.0_typescript@6.0.3/node_modules/wevu/dist/runtime/app/context.mjs',
    )).toBe('wevu/dist/runtime/app/context.mjs')
    expect(formatModuleIdentifier(
      '../../../weapp-vite/packages-runtime/wevu/dist/runtime/app/context.mjs',
    )).toBe('wevu/dist/runtime/app/context.mjs')
    expect(formatModuleIdentifier(
      '../../../weapp-vite/@weapp-core/constants/dist/index.js',
    )).toBe('@weapp-core/constants/dist/index.js')
    expect(formatModuleIdentifier('\0C:\\project\\src\\entry.ts?lang.ts')).toBe('entry.ts')
  })
})
