import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(pages: string[] = []) {
  const cwd = '/root'
  const absoluteSrcRoot = '/root/src'
  const appEntry = { json: { pages } }
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd,
      absoluteSrcRoot,
      relativeOutputPath(absoluteBase: string) {
        if (!absoluteBase.startsWith(`${absoluteSrcRoot}/`)) {
          return undefined
        }
        return absoluteBase.slice(absoluteSrcRoot.length + 1).replace(/\\/g, '/')
      },
    },
    scanService: {
      appEntry,
      loadAppEntry: async () => appEntry,
      loadSubPackages: () => [],
    },
  } as any
}

function createResolver() {
  return async (source: string, importer?: string) => {
    if (!importer) {
      return { id: source }
    }
    if (source.startsWith('.')) {
      return { id: path.resolve(path.dirname(importer), source) }
    }
    return { id: source }
  }
}

describe('<script setup> auto usingComponents', () => {
  it('registers imported component into usingComponents and strips import', async () => {
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    const sfc = `
<template>
  <Child />
</template>
<script setup>
import Child from '../child/index.vue'
</script>
    `.trim()

    const transformed = await plugin.transform!.call(
      { resolve: createResolver() } as any,
      sfc,
      '/root/src/components/parent/index.vue',
    )

    expect(transformed?.code).toBeDefined()
    expect(String(transformed!.code)).not.toContain('../child/index.vue')
    expect(String(transformed!.code)).toContain('__weappViteUsingComponent')
    expect(String(transformed!.code)).toContain('/components/child/index')

    const emitted: Array<{ fileName: string, source: string }> = []
    await plugin.generateBundle!.call(
      {
        resolve: createResolver(),
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      } as any,
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/parent/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({
      component: true,
      usingComponents: {
        Child: '/components/child/index',
      },
    })
  })

  it('auto overrides <json>.usingComponents but warns on conflict', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const plugin = createVueTransformPlugin(createCtx(['pages/home/index']))

    const sfc = `
<template>
  <Child />
</template>
<script setup>
import Child from '../child/index.vue'
</script>
<json>
{
  "usingComponents": {
    "Child": "/wrong/path"
  }
}
</json>
    `.trim()

    await plugin.transform!.call(
      { resolve: createResolver() } as any,
      sfc,
      '/root/src/components/parent2/index.vue',
    )

    const emitted: Array<{ fileName: string, source: string }> = []
    await plugin.generateBundle!.call(
      {
        resolve: createResolver(),
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      } as any,
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'components/parent2/index.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({
      component: true,
      usingComponents: {
        Child: '/components/child/index',
      },
    })

    expect(warnSpy).toHaveBeenCalled()
    const messages = warnSpy.mock.calls.map(args => String(args[0]))
    expect(messages.some(m => m.includes('usingComponents') && m.includes('冲突'))).toBe(true)
    warnSpy.mockRestore()
  })
})
