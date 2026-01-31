import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createVueResolverPlugin } from '../../src/plugins/vue/resolver'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import {
  parseWeappVueStyleRequest,
  WEAPP_VUE_STYLE_VIRTUAL_PREFIX,
} from '../../src/plugins/vue/transform/styleRequest'

function createCtx(root: string) {
  const absoluteSrcRoot = path.join(root, 'src')
  return {
    runtimeState: {
      scan: {
        isDirty: false,
      },
    },
    configService: {
      cwd: root,
      absoluteSrcRoot,
      isDev: true,
      platform: 'weapp',
      outputExtensions: {
        wxss: 'wxss',
        wxs: 'wxs',
      },
      weappViteConfig: {},
      relativeOutputPath(absoluteBase: string) {
        if (!absoluteBase.startsWith(`${absoluteSrcRoot}/`)) {
          return undefined
        }
        return absoluteBase.slice(absoluteSrcRoot.length + 1).replace(/\\/g, '/')
      },
      relativeCwd(p: string) {
        return path.relative(root, p).replace(/\\/g, '/')
      },
      relativeAbsoluteSrcRoot(p: string) {
        return path.relative(absoluteSrcRoot, p).replace(/\\/g, '/')
      },
    },
    scanService: {
      appEntry: { json: { pages: ['pages/index/index'] } },
      loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
      loadSubPackages: () => [],
    },
  } as any
}

describe('vue style import resolution', () => {
  it('resolves css/scss style requests to real SFC paths and loads style src', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-style-import-'))
    const srcRoot = path.join(root, 'src')
    const pageDir = path.join(srcRoot, 'pages', 'index')
    const vueFile = path.join(pageDir, 'index.vue')

    try {
      await fs.ensureDir(pageDir)
      await fs.writeFile(
        vueFile,
        [
          '<template><view /></template>',
          '<style lang="css">@import "./hello.css"; .css-inline { color: red; }</style>',
          '<style lang="scss">@import "./scss-import.css"; .scss-inline { color: blue; }</style>',
          '<style src="./external.css"></style>',
        ].join('\n'),
        'utf8',
      )
      await fs.writeFile(path.join(pageDir, 'hello.css'), '.hello-import { color: red; }', 'utf8')
      await fs.writeFile(path.join(pageDir, 'scss-import.css'), '.scss-imported { color: blue; }', 'utf8')
      await fs.writeFile(path.join(pageDir, 'external.css'), '.external-src { color: green; }', 'utf8')

      const ctx = createCtx(root)
      const transformPlugin = createVueTransformPlugin(ctx)
      const resolverPlugin = createVueResolverPlugin(ctx)

      const transformed = await transformPlugin.transform!(
        await fs.readFile(vueFile, 'utf8'),
        vueFile,
      ) as any

      const styleImports = Array.from(transformed.code.matchAll(/import\s+("([^"]+)");/g))
        .map(match => JSON.parse(match[1]))

      expect(styleImports.length).toBe(3)
      for (const request of styleImports) {
        expect(request.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(true)
      }

      const parsed = styleImports
        .map((request) => {
          const parsedRequest = parseWeappVueStyleRequest(request)
          return { request, parsed: parsedRequest }
        })
        .filter(item => item.parsed)
        .sort((a, b) => (a.parsed!.index - b.parsed!.index))

      expect(parsed.map(item => item.parsed!.index)).toEqual([0, 1, 2])

      for (const { request, parsed: parsedRequest } of parsed) {
        const resolvedId = await resolverPlugin.resolveId!(request, vueFile) as string
        expect(resolvedId.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)).toBe(false)
        const [resolvedPath] = resolvedId.split('?')
        expect(path.resolve(resolvedPath)).toBe(path.resolve(vueFile))
        expect(path.dirname(resolvedPath)).toBe(pageDir)
        if (parsedRequest?.index === 2) {
          const loaded = await transformPlugin.load!(request) as any
          expect(loaded?.code).toContain('.external-src')
        }
      }
    }
    finally {
      await fs.remove(root)
    }
  })
})
