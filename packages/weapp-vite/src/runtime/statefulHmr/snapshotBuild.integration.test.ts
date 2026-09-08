import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { resetRuntimeStateForFreshBuild } from '../resetRuntimeState'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { createStatefulHmrSnapshotOptions } from './snapshotBuild'

const temporaryRoots: string[] = []

async function createProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-snapshot-component-'))
  temporaryRoots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-component-regression', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ weapp: { srcRoot: "src", react: { renderMode: "auto", compiler: false } } })',
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.ts': 'Page({})',
    'src/pages/index/index.json': JSON.stringify({ usingComponents: { 'wevu-leaf': '/components/wevu-leaf/index' } }),
    'src/pages/index/index.wxml': '<view><wevu-leaf /></view>',
    'src/pages/index/index.wxss': '.page { color: red; }',
    'src/components/wevu-leaf/index.vue': [
      '<script setup lang="ts">',
      'defineProps<{ label: string }>()',
      'defineComponentJson({ options: { multipleSlots: true } })',
      '</script>',
      '<template><view><text>{{ label }}</text><slot /></view></template>',
    ].join('\n'),
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, content)
  }
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true })
  await fs.symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
  return root
}

function readComponentJson(outputs: Array<OutputChunk | OutputAsset>) {
  const output = outputs.find(item => item.fileName === 'components/wevu-leaf/index.json')
  expect(output?.type).toBe('asset')
  return JSON.parse(String((output as OutputAsset).source)) as unknown
}

describe('stateful snapshot component metadata', () => {
  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  })

  it('retains the component declaration across fresh snapshot builds after a page style edit', async () => {
    const root = await createProject()
    const options = { cwd: root, isDev: true, mode: 'development' }
    for (const color of ['red', 'blue']) {
      await fs.writeFile(path.join(root, 'src/pages/index/index.wxss'), `.page { color: ${color}; }`)
      const snapshot = await createStatefulHmrSnapshotOptions(options)
      snapshot.options.build = { ...snapshot.options.build, watch: undefined, write: false }
      snapshot.options.plugins = [...(snapshot.options.plugins ?? []), {
        name: 'snapshot-assets-only',
        enforce: 'post',
        generateBundle(_options, bundle) {
          for (const [name, output] of Object.entries(bundle)) {
            if (output.type === 'chunk') {
              delete bundle[name]
            }
          }
        },
      }]
      const result = await build(snapshot.options)
      expect(snapshot.getDelegatedComponentEntryIds()).toEqual([
        (await fs.realpath(path.join(root, 'src/components/wevu-leaf/index.vue'))).replaceAll('\\', '/'),
      ])
      const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
      expect(readComponentJson(outputs), color).toEqual({ component: true, options: { multipleSlots: true } })
    }
  })

  it('retains component metadata after resetting the active build context for a full restart', async () => {
    const root = await createProject()
    const ctx = createCompilerContextInstance()
    ctx.currentBuildTarget = 'app'
    const loadOptions = { cwd: root, isDev: true, mode: 'development' }
    for (let iteration = 0; iteration < 2; iteration++) {
      resetRuntimeStateForFreshBuild(ctx.runtimeState)
      await ctx.configService.load(loadOptions)
      await ctx.scanService.loadAppEntry()
      ctx.scanService.loadSubPackages()
      const options = ctx.configService.merge(undefined, createSharedBuildConfig(ctx.configService, ctx.scanService))
      options.build = { ...options.build, watch: undefined, write: false }
      const result = await build(options)
      const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
      expect(readComponentJson(outputs), `restart ${iteration}`).toEqual({ component: true, options: { multipleSlots: true } })
    }
  })
})
