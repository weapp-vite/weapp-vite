import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeWatchPath } from '../../src/utils/path'

vi.mock('wevu/compiler', async () => {
  const actual = await vi.importActual<typeof import('wevu/compiler')>('wevu/compiler')
  return {
    ...actual,
    compileVueFile: vi.fn(async () => {
      return {
        script: undefined,
        template: '<view />',
        style: '',
        config: undefined,
      }
    }),
  }
})

vi.mock('../../src/plugins/vue/transform/vitePlugin/injectPageFeatures', () => {
  return {
    injectWevuPageFeaturesInJsWithViteResolver: vi.fn(async (_ctx: any, code: string) => {
      return {
        transformed: false,
        code,
      }
    }),
  }
})

let tempRoot: string | undefined

afterEach(async () => {
  if (tempRoot) {
    await fs.remove(tempRoot)
    tempRoot = undefined
  }
})

describe('vue transform plugin: watch .vue files', () => {
  it('adds watchFile for fallback-compiled page .vue entries', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vue-watch-'))
    const cwd = tempRoot
    const absoluteSrcRoot = path.join(tempRoot, 'src')
    const pageBase = path.join(absoluteSrcRoot, 'pages/vue-events/index')
    const pageVue = `${pageBase}.vue`

    await fs.ensureDir(path.dirname(pageVue))
    await fs.writeFile(pageVue, '<template><view /></template>', 'utf-8')

    const watchedFiles: string[] = []
    const emittedFiles: any[] = []

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform')

    const plugin = createVueTransformPlugin({
      configService: {
        cwd,
        absoluteSrcRoot,
        isDev: true,
        relativeOutputPath(p: string) {
          const rel = path.relative(absoluteSrcRoot, p)
          if (!rel || rel.startsWith('..')) {
            return ''
          }
          return rel
        },
      },
      scanService: {
        appEntry: {
          json: {
            pages: ['pages/vue-events/index'],
          },
        },
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    const bundle: Record<string, any> = {}

    await plugin.generateBundle?.call(
      {
        addWatchFile: (file: string) => watchedFiles.push(file),
        emitFile: (asset: any) => emittedFiles.push(asset),
      } as any,
      {},
      bundle,
    )

    expect(watchedFiles).toContain(normalizeWatchPath(pageVue))
    expect(emittedFiles.some(x => x?.fileName?.endsWith('.wxml'))).toBeTruthy()
    expect(emittedFiles.some(x => x?.fileName?.endsWith('.json'))).toBeFalsy()
  })

  it('adds watchFile for virtual module resolved .vue filename', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vue-watch-'))
    const cwd = tempRoot
    const absoluteSrcRoot = path.join(tempRoot, 'src')
    const pageVueRelative = 'src/pages/vue-events/index.vue'
    const pageVue = path.join(cwd, pageVueRelative)

    await fs.ensureDir(path.dirname(pageVue))
    await fs.writeFile(pageVue, '<template><view /></template>', 'utf-8')

    const watchedFiles: string[] = []

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform')

    const plugin = createVueTransformPlugin({
      configService: {
        cwd,
        absoluteSrcRoot,
        isDev: true,
        relativeOutputPath(p: string) {
          const rel = path.relative(absoluteSrcRoot, p)
          if (!rel || rel.startsWith('..')) {
            return ''
          }
          return rel
        },
      },
      scanService: {
        loadAppEntry: async () => ({ json: { pages: ['pages/vue-events/index'] } }),
        loadSubPackages: () => [],
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await plugin.transform?.call(
      {
        addWatchFile: (file: string) => watchedFiles.push(file),
      } as any,
      '<template><view /></template>',
      `\0vue:${pageVueRelative}`,
    )

    expect(watchedFiles).toContain(normalizeWatchPath(pageVue))
  })
})
