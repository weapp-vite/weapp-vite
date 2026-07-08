import { describe, expect, it } from 'vitest'
import { injectRequestGlobalsIntoLoadResult } from './requestGlobals'

describe('load request globals injection', () => {
  it('skips request-global SFC injection for vue source files', () => {
    const result = {
      code: [
        '<script setup lang="ts">',
        'const payload = await fetch("/api")',
        '</script>',
      ].join('\n'),
      map: null,
    }

    expect(injectRequestGlobalsIntoLoadResult(
      result,
      '/virtual/src/pages/index.vue',
      ['fetch'],
      { localBindings: true },
    )).toEqual(result)
  })

  it('still injects request globals for non-vue source files', () => {
    const result = {
      code: 'export const run = () => fetch("/api")\n',
      map: null,
    }

    const injected = injectRequestGlobalsIntoLoadResult(
      result,
      '/virtual/src/pages/index.ts',
      ['fetch'],
      { localBindings: true },
    )

    expect(injected).not.toEqual(result)
    expect(injected.code).toContain('installWebRuntimeGlobals')
    expect(injected.code).toContain('var fetch = __rh.fetch')
  })
})
