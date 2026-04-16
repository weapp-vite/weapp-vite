import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { useLoadEntry } from '../../src/plugins/hooks/useLoadEntry'
import { createTestCompilerContext, getFixture } from '../utils'

describe('vue template autoImportComponents', () => {
  const fixtureSource = getFixture('auto-import')
  const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
  let tempDir = ''
  let ctx: Awaited<ReturnType<typeof createTestCompilerContext>>['ctx']
  let disposeCtx: (() => Promise<void>) | undefined
  let vuePagePath = ''

  beforeAll(async () => {
    await fs.ensureDir(tempRoot)
    tempDir = await fs.mkdtemp(path.join(tempRoot, 'vue-auto-import-'))
    await fs.copy(fixtureSource, tempDir, {
      dereference: true,
      filter: (src) => {
        const relative = path.relative(fixtureSource, src).replaceAll('\\', '/')
        if (!relative) {
          return true
        }
        return !(
          relative === 'node_modules'
          || relative.startsWith('node_modules/')
          || relative === 'dist'
          || relative.startsWith('dist/')
          || relative === '.weapp-vite'
          || relative.startsWith('.weapp-vite/')
        )
      },
    })

    const viteConfigPath = path.resolve(tempDir, 'vite.config.ts')
    const viteConfigSource = await fs.readFile(viteConfigPath, 'utf8')
    await fs.writeFile(
      viteConfigPath,
      viteConfigSource
        .replace(
          `import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'`,
          `import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'`,
        )
        .replace(
          `resolvers: [
          VantResolver()
        ]`,
          `resolvers: [
          VantResolver(),
          TDesignResolver()
        ]`,
        ),
      'utf8',
    )

    vuePagePath = path.resolve(tempDir, 'src/pages/VueAutoImport/index.vue')
    await fs.ensureDir(path.dirname(vuePagePath))
    await fs.outputFile(
      vuePagePath,
      `<template>\n  <view>\n    <van-button />\n  </view>\n</template>\n\n<json>\n{\n  \"navigationBarTitleText\": \"Vue Auto Import\"\n}\n</json>\n`,
      'utf8',
    )

    const result = await createTestCompilerContext({ cwd: tempDir })
    ctx = result.ctx
    disposeCtx = result.dispose
  })

  afterAll(async () => {
    await disposeCtx?.()
    if (tempDir) {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
  })

  it('augments page json usingComponents from Vue template tags', async () => {
    const { loadEntry, jsonEmitFilesMap } = useLoadEntry(ctx)

    const fakePluginContext = {
      addWatchFile: () => {},
      resolve: async (source: string, importer?: string) => {
        if (importer && source.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), source) }
        }
        if (path.isAbsolute(source)) {
          return { id: source }
        }
        return { id: source }
      },
      load: async () => {},
      emitFile: () => {},
    } as any

    await loadEntry.call(fakePluginContext, vuePagePath, 'page')

    const records = Array.from(jsonEmitFilesMap.values())
    const expectedJsonPath = path.resolve(path.dirname(vuePagePath), 'index.json')
    const pageJson = records.find(record => record.entry.type === 'page' && record.entry.jsonPath === expectedJsonPath)
    expect(pageJson).toBeDefined()
    expect(pageJson!.entry.json.usingComponents).toMatchObject({
      'van-button': '@vant/weapp/button',
    })
  })

  it('does not hoist child auto-import resolver components into parent component json', async () => {
    const parentComponentPath = path.resolve(tempDir, 'src/components/ParentCard/index.vue')
    const childComponentPath = path.resolve(tempDir, 'src/components/AvatarCard/index.vue')

    await fs.ensureDir(path.dirname(parentComponentPath))
    await fs.ensureDir(path.dirname(childComponentPath))

    await fs.outputFile(
      childComponentPath,
      `<template>\n  <view>\n    <t-avatar />\n  </view>\n</template>\n\n<json>\n{\n  \"component\": true\n}\n</json>\n`,
      'utf8',
    )

    await fs.outputFile(
      parentComponentPath,
      `<script setup lang="ts">\nimport AvatarCard from '../AvatarCard/index.vue'\n</script>\n\n<template>\n  <view>\n    <AvatarCard />\n  </view>\n</template>\n\n<json>\n{\n  \"component\": true\n}\n</json>\n`,
      'utf8',
    )

    const { loadEntry, jsonEmitFilesMap } = useLoadEntry(ctx)

    const fakePluginContext = {
      addWatchFile: () => {},
      resolve: async (source: string, importer?: string) => {
        if (importer && source.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), source) }
        }
        if (path.isAbsolute(source)) {
          return { id: source }
        }
        return { id: source }
      },
      load: async () => {},
      emitFile: () => {},
    } as any

    await loadEntry.call(fakePluginContext, parentComponentPath, 'component')

    const records = Array.from(jsonEmitFilesMap.values())
    const expectedParentJsonPath = path.resolve(path.dirname(parentComponentPath), 'index.json')
    const parentJson = records.find(record => record.entry.type === 'component' && record.entry.jsonPath === expectedParentJsonPath)

    expect(parentJson).toBeDefined()
    expect(parentJson!.entry.json.usingComponents).toMatchObject({
      AvatarCard: '/components/AvatarCard/index',
    })
    expect(parentJson!.entry.json.usingComponents).not.toHaveProperty('t-avatar')
  })

  it('does not hoist grandchild auto-import resolver components into page or parent json', async () => {
    const pagePath = path.resolve(tempDir, 'src/pages/NestedAutoImport/index.vue')
    const parentComponentPath = path.resolve(tempDir, 'src/components/NestedParent/index.vue')
    const childComponentPath = path.resolve(tempDir, 'src/components/NestedChild/index.vue')

    await fs.ensureDir(path.dirname(pagePath))
    await fs.ensureDir(path.dirname(parentComponentPath))
    await fs.ensureDir(path.dirname(childComponentPath))

    await fs.outputFile(
      childComponentPath,
      `<template>\n  <view>\n    <t-avatar />\n  </view>\n</template>\n\n<json>\n{\n  \"component\": true\n}\n</json>\n`,
      'utf8',
    )

    await fs.outputFile(
      parentComponentPath,
      `<script setup lang="ts">\nimport NestedChild from '../NestedChild/index.vue'\n</script>\n\n<template>\n  <view>\n    <NestedChild />\n  </view>\n</template>\n\n<json>\n{\n  \"component\": true\n}\n</json>\n`,
      'utf8',
    )

    await fs.outputFile(
      pagePath,
      `<script setup lang="ts">\nimport NestedParent from '../../components/NestedParent/index.vue'\n</script>\n\n<template>\n  <view>\n    <NestedParent />\n  </view>\n</template>\n\n<json>\n{\n  \"navigationBarTitleText\": \"Nested Auto Import\"\n}\n</json>\n`,
      'utf8',
    )

    const { loadEntry, jsonEmitFilesMap } = useLoadEntry(ctx)

    const fakePluginContext = {
      addWatchFile: () => {},
      resolve: async (source: string, importer?: string) => {
        if (importer && source.startsWith('.')) {
          return { id: path.resolve(path.dirname(importer), source) }
        }
        if (path.isAbsolute(source)) {
          return { id: source }
        }
        return { id: source }
      },
      load: async () => {},
      emitFile: () => {},
    } as any

    await loadEntry.call(fakePluginContext, pagePath, 'page')

    const records = Array.from(jsonEmitFilesMap.values())
    const expectedPageJsonPath = path.resolve(path.dirname(pagePath), 'index.json')
    const pageJson = records.find(record => record.entry.type === 'page' && record.entry.jsonPath === expectedPageJsonPath)

    expect(pageJson).toBeDefined()
    expect(pageJson!.entry.json.usingComponents).toMatchObject({
      NestedParent: '/components/NestedParent/index',
    })
    expect(pageJson!.entry.json.usingComponents).not.toHaveProperty('t-avatar')
  })
})
