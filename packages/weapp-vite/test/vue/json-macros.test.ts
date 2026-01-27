import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createVueTransformPlugin } from '../../src/plugins/vue/transform'
import { compileVueFile } from '../../src/plugins/vue/transform/compileVueFile'

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
      isDev: true,
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

describe('<script setup> json macros', () => {
  it('does not mutate vue/compiler-sfc parse cache for macro stripping', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const file = path.join(root, 'src/pages/index/index.vue')

    const sfc = `
<template><view>index</view></template>
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '首页',
})
</script>
    `.trim()

    const a = await compileVueFile(sfc, file)
    const b = await compileVueFile(sfc, file)

    expect(a.config).toBeDefined()
    expect(b.config).toBeDefined()
    expect(JSON.parse(a.config!).navigationBarTitleText).toBe('首页')
    expect(JSON.parse(b.config!).navigationBarTitleText).toBe('首页')
  })

  it('keeps referenced identifiers used by json macros', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const file = path.join(root, 'src/pages/index/index.vue')

    const sfc = `
<template><view>index</view></template>
<script setup lang="ts">
const config = {
  navigationBarTitleText: '变量宏',
}
definePageJson(config)
</script>
    `.trim()

    const result = await compileVueFile(sfc, file)

    expect(result.config).toBeDefined()
    expect(JSON.parse(result.config!).navigationBarTitleText).toBe('变量宏')
  })

  it('changes transformed js when macro content changes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))
      const file = path.join(srcRoot, 'pages/home/index.vue')

      const base = (title: string) => `
<template><view>home</view></template>
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '${title}'
})
</script>
      `.trim()

      const a = await plugin.transform!(base('首页'), file)
      const b = await plugin.transform!(base('222'), file)

      expect(a?.code).toContain('__weappViteJsonMacroHash')
      expect(b?.code).toContain('__weappViteJsonMacroHash')
      expect(a?.code).not.toBe(b?.code)
    }
    finally {
      await fs.remove(root)
    }
  })

  it('merges defineComponentJson() into emitted json with highest priority', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))

      const file = path.join(srcRoot, 'components/foo/index.vue')
      const transformed = await plugin.transform!(
        `
<template><view>ok</view></template>
<script setup lang="ts">
defineComponentJson({
  styleIsolation: 'isolated',
  usingComponents: {
    a: '/from-macro'
  }
})
</script>
<json lang="jsonc">
{
  "styleIsolation": "apply-shared",
  "usingComponents": {
    "a": "/from-json",
    "b": "/b"
  }
}
</json>
        `.trim(),
        file,
      )

      expect(transformed?.code).not.toContain('defineComponentJson')

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        },
        {},
        {},
      )

      const jsonAsset = emitted.find(item => item.fileName === 'components/foo/index.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        component: true,
        styleIsolation: 'isolated',
        usingComponents: {
          a: '/from-macro',
          b: '/b',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('overwrites component json when macro is removed', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))
      const file = path.join(srcRoot, 'components/hello/index.vue')
      const bundle: Record<string, any> = {}

      const emitFile = (payload: { fileName: string, source: string }) => {
        bundle[payload.fileName] = { type: 'asset', source: payload.source }
      }

      const withMacro = `
<template><view>ok</view></template>
<script setup lang="ts">
defineComponentJson({
  styleIsolation: 'apply-shared',
  componentPlaceholder: {
    a: '1'
  }
})
</script>
      `.trim()

      await plugin.transform!(withMacro, file)
      await plugin.generateBundle!.call({ emitFile }, {}, bundle)

      const first = JSON.parse(bundle['components/hello/index.json'].source)
      expect(first.styleIsolation).toBe('apply-shared')
      expect(first.componentPlaceholder).toEqual({ a: '1' })

      const withoutMacro = `
<template><view>ok</view></template>
<script setup lang="ts">
const foo = 1
</script>
      `.trim()

      await plugin.transform!(withoutMacro, file)
      await plugin.generateBundle!.call({ emitFile }, {}, bundle)

      const next = JSON.parse(bundle['components/hello/index.json'].source)
      expect(next.styleIsolation).toBeUndefined()
      expect(next.componentPlaceholder).toBeUndefined()
    }
    finally {
      await fs.remove(root)
    }
  })

  it('merges defineAppJson() over existing bundle asset', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/home/index']))
      const file = path.join(srcRoot, 'app.vue')

      await plugin.transform!(
        `
<template><view>app</view></template>
<script setup lang="ts">
defineAppJson({
  style: 'v3'
})
</script>
        `.trim(),
        file,
      )

      const bundle: Record<string, any> = {
        'app.json': {
          type: 'asset',
          source: JSON.stringify({ style: 'v2', pages: ['pages/home/index'] }),
        },
      }

      await plugin.generateBundle!.call(
        {
          emitFile() {},
        },
        {},
        bundle,
      )

      expect(bundle['app.json']).toBeDefined()
      expect(JSON.parse(String(bundle['app.json'].source))).toEqual({
        style: 'v3',
        pages: ['pages/home/index'],
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('supports imports and expressions inside macro', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      await fs.outputFile(
        path.join(srcRoot, 'pages/demo/config.ts'),
        `export const prefix = '/from-import'\n`,
      )

      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/index']))
      const file = path.join(srcRoot, 'pages/demo/index.vue')
      const sfc = `
<template><view>demo</view></template>
<script setup lang="ts">
import { prefix } from './config'
const name = 'X'
definePageJson({
  usingComponents: {
    [name]: prefix + '/x'
  }
})
</script>
      `.trim()

      await plugin.transform!(sfc, file)

      const emitted: Array<{ fileName: string, source: string }> = []
      await plugin.generateBundle!.call(
        {
          emitFile(payload: any) {
            emitted.push({ fileName: payload.fileName, source: String(payload.source) })
          },
        },
        {},
        {},
      )

      const jsonAsset = emitted.find(item => item.fileName === 'pages/demo/index.json')
      expect(jsonAsset).toBeDefined()
      expect(JSON.parse(jsonAsset!.source)).toEqual({
        usingComponents: {
          X: '/from-import/x',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('updates existing page json asset in fallback compilation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/index/index']))

      const file = path.join(srcRoot, 'pages/index/index.vue')
      await fs.outputFile(
        file,
        `
<template><view>index</view></template>
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '首页'
})
</script>
        `.trim(),
      )

      const bundle: Record<string, any> = {
        'pages/index/index.json': {
          type: 'asset',
          source: JSON.stringify({
            usingComponents: {
              HelloWorld: '/components/HelloWorld/index',
            },
          }),
        },
      }

      await plugin.generateBundle!.call(
        {
          emitFile() {},
        },
        {},
        bundle,
      )

      expect(bundle['pages/index/index.json']).toBeDefined()
      expect(JSON.parse(String(bundle['pages/index/index.json'].source))).toEqual({
        navigationBarTitleText: '首页',
        usingComponents: {
          HelloWorld: '/components/HelloWorld/index',
        },
      })
    }
    finally {
      await fs.remove(root)
    }
  })

  it('avoids temp dir cleanup race in concurrent transforms', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-macros-'))
    const srcRoot = path.join(root, 'src')

    try {
      const plugin = createVueTransformPlugin(createCtx(root, ['pages/demo/a', 'pages/demo/b']))
      const dir = path.join(srcRoot, 'pages/demo')
      await fs.ensureDir(dir)

      const fileA = path.join(dir, 'a.vue')
      const fileB = path.join(dir, 'b.vue')

      const base = (title: string) => `
<template><view>home</view></template>
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '${title}'
})
</script>
      `.trim()

      await fs.outputFile(fileA, base('A'))
      await fs.outputFile(fileB, base('B'))

      const originalWriteFile = fs.writeFile.bind(fs)
      let writeCount = 0
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockImplementation(async (...args: any[]) => {
        writeCount += 1
        if (writeCount === 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return originalWriteFile(...args)
      })

      try {
        await Promise.all([
          plugin.transform!(base('A'), fileA),
          plugin.transform!(base('B'), fileB),
        ])
      }
      finally {
        writeFileSpy.mockRestore()
      }
    }
    finally {
      await fs.remove(root)
    }
  })
})
