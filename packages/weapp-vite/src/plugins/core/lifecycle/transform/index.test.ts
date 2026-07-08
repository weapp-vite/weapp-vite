import { describe, expect, it } from 'vitest'
import { createTransformHook } from './index'

describe('transform request globals injection', () => {
  it('skips request-global SFC injection for vue source files', async () => {
    const sourceId = '/virtual/src/pages/index.vue'
    const transform = createTransformHook({
      ctx: {
        configService: {
          absoluteSrcRoot: '/virtual/src',
          packageJson: {
            dependencies: {
              axios: '^1.0.0',
            },
          },
          relativeAbsoluteSrcRoot(id: string) {
            return id.replace('/virtual/src/', '')
          },
          weappViteConfig: {},
        },
        runtimeState: undefined,
      },
      entriesMap: new Map([
        ['pages/index', { type: 'page' }],
      ]),
      loadedEntrySet: new Set<string>([sourceId]),
      resolvedEntryMap: new Map(),
    } as any)

    const code = [
      '<script setup lang="ts">',
      'const payload = await fetch("/api")',
      '</script>',
    ].join('\n')

    const result = await transform.call({}, code, sourceId)

    expect(result).toBeNull()
  })
})
