import fs from 'fs-extra'
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
    await fs.copy(fixtureSource, tempDir, { dereference: true })

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
})
