import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

function createCtx(root: string, pages: string[] = []) {
  const absoluteSrcRoot = path.join(root, 'src')
  const appEntry = { json: { pages } }
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
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
    autoImportService: {
      resolve(tag: string) {
        if (tag === 't-cell-group') {
          return {
            kind: 'resolver',
            value: {
              name: tag,
              from: 'lib/t-cell-group',
            },
          }
        }
        if (tag === 'TButton') {
          return {
            kind: 'resolver',
            value: {
              name: tag,
              from: 'lib/t-button',
            },
          }
        }
        return undefined
      },
    },
  } as any
}

describe('tsx auto usingComponents integration', () => {
  it('emits json usingComponents inferred from jsx imports and tags', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-jsx-auto-using-'))
    const srcRoot = path.join(root, 'src')

    try {
      await fs.outputFile(
        path.join(srcRoot, 'components/card/index.vue'),
        '<template><view>card</view></template>',
      )

      const pageFile = path.join(srcRoot, 'pages/demo/index.tsx')
      const source = `
import { defineComponent } from 'wevu'
import Card from '../../components/card/index.vue'

export default defineComponent({
  render() {
    return <view><Card /><t-cell-group /></view>
  },
})
      `.trim()

      await fs.outputFile(pageFile, source)

      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/index']))
      const resolver = async (request: string, importer?: string) => {
        if (!importer) {
          return { id: request } as any
        }
        if (request.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), request) } as any
        }
        return { id: request } as any
      }

      const transformed = await plugin.transform!.call(
        { resolve: resolver } as any,
        source,
        pageFile,
      )

      expect(transformed?.code).toBeDefined()

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          addWatchFile() {},
          resolve: resolver,
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        } as any,
        {},
        {},
      )

      const jsonAsset = emitted.find(item => item.fileName === 'pages/demo/index.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        usingComponents: {
          't-cell-group': 'lib/t-cell-group',
          'Card': '/components/card/index',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('prefers autoUsingComponents over autoImportTags on conflicts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-jsx-auto-using-conflict-'))
    const srcRoot = path.join(root, 'src')
    const warnSpy = vi.spyOn(logger as any, 'warn').mockImplementation(() => {})

    try {
      await fs.outputFile(
        path.join(srcRoot, 'components/t-button/index.vue'),
        '<template><view>button</view></template>',
      )

      const pageFile = path.join(srcRoot, 'pages/demo/conflict.tsx')
      const source = `
import { defineComponent } from 'wevu'
import TButton from '../../components/t-button/index.vue'

export default defineComponent({
  render() {
    return <view><TButton /></view>
  },
})
      `.trim()

      await fs.outputFile(pageFile, source)

      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/conflict']))
      const resolver = async (request: string, importer?: string) => {
        if (!importer) {
          return { id: request } as any
        }
        if (request.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), request) } as any
        }
        return { id: request } as any
      }

      const transformed = await plugin.transform!.call(
        { resolve: resolver } as any,
        source,
        pageFile,
      )

      expect(transformed?.code).toBeDefined()

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          addWatchFile() {},
          resolve: resolver,
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        } as any,
        {},
        {},
      )

      const jsonAsset = emitted.find(item => item.fileName === 'pages/demo/conflict.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        usingComponents: {
          TButton: '/components/t-button/index',
        },
      })

      const messages = warnSpy.mock.calls.map(call => String(call[0]))
      expect(messages.some(message => message.includes('usingComponents') && message.includes('冲突'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
      await fs.remove(root)
    }
  })
})
