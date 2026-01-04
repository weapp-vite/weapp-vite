import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'

vi.mock('../../src/plugins/vue/transform/compileVueFile', () => {
  return {
    __esModule: true,
    compileVueFile: vi.fn(async () => {
      return {
        script: `import { ref } from 'wevu';\nconst x = ref(0)\n`,
        template: '<view>ok</view>',
        style: '.a{color:red;}',
        config: JSON.stringify({ navigationBarTitleText: 'Demo' }),
        meta: {},
      }
    }),
  }
})

function createCtx(root: string) {
  const absoluteSrcRoot = path.join(root, 'src')
  const appEntry = { json: { pages: ['pages/demo/index'] } }
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
      absoluteSrcRoot,
      isDev: false,
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

describe('vue fallback compilation', () => {
  it('does not emit JS assets in production fallback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vue-fallback-'))
    try {
      const file = path.join(root, 'src/pages/demo/index.vue')
      await fs.outputFile(file, '<template><view>demo</view></template>')

      const plugin = createVueTransformPlugin(createCtx(root))

      const emitted: Array<{ type: string, fileName: string, source?: string }> = []
      await plugin.generateBundle!.call(
        {
          addWatchFile() {},
          async resolve() {
            return null
          },
          emitFile(payload: any) {
            emitted.push({ type: payload.type, fileName: payload.fileName, source: payload.source })
          },
        } as any,
        {},
        {},
      )

      expect(emitted.some(e => e.fileName === 'pages/demo/index.js')).toBe(false)
      expect(emitted.some(e => e.fileName === 'pages/demo/index.wxml')).toBe(true)
      expect(emitted.some(e => e.fileName === 'pages/demo/index.wxss')).toBe(true)
      expect(emitted.some(e => e.fileName === 'pages/demo/index.json')).toBe(true)
    }
    finally {
      await fs.remove(root)
    }
  })
})
