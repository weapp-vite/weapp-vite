import type { Plugin } from 'vite'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from './outputFinalizer/publicationObservation'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import { expect, it } from 'vitest'
import { inspectClassicPublication } from '../../../../scripts/workspace-hmr/classicPublication'
import { CompilerSession } from '../runtime/compilerSession'

it('keeps conditional npm component publication closed across classic development generations', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-uni-publication-')))
  const outDir = path.join(root, 'dist')
  const session = new CompilerSession()
  const receipts: NativeOutputPublicationSnapshot[] = []
  const observations: Promise<void>[] = []
  const failures: unknown[] = []
  const graphObservations: unknown[] = []
  const pending = new WeakMap<object, { api: NativeOutputPublicationApi, epoch: number }>()
  const graphObserver: Plugin = {
    name: 'uni-app-conditional-graph-observer',
    enforce: 'pre',
    generateBundle: {
      order: 'pre',
      sequential: true,
      handler(_options, bundle) {
        const hmr = session.context.runtimeState.build.hmr
        graphObservations.push({
          fullEntryScan: hmr.fullEntryScan,
          didEmitAllEntries: hmr.didEmitAllEntries,
          dirtyReasonSummary: hmr.profile.dirtyReasonSummary,
          lastHmrEntryIds: [...hmr.lastHmrEntryIds].map(file => path.relative(root, file)),
          lastEmittedEntryIds: [...hmr.lastEmittedEntryIds].map(file => path.relative(root, file)),
          chunks: Object.values(bundle).filter(output => output.type === 'chunk').map(output => ({
            fileName: output.fileName,
            facade: output.facadeModuleId,
            moduleIds: output.moduleIds.filter(id => id.includes('conditional-table')),
          })).filter(chunk => chunk.moduleIds.length || chunk.fileName.includes('conditional-table')),
        })
      },
    },
  }
  const observer: Plugin = {
    name: 'uni-app-conditional-publication-observer',
    generateBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const api = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api as NativeOutputPublicationApi | undefined
        if (!api) {
          throw new Error('Classic development publication observer is missing')
        }
        pending.set(this.environment, { api, epoch: api.getEpoch() })
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const publication = pending.get(this.environment)
        if (!publication) {
          throw new Error('Native publication has no matching generation')
        }
        pending.delete(this.environment)
        observations.push(publication.api.whenCommitted(outDir, publication.epoch).then((snapshot) => {
          if (!snapshot) {
            throw new Error('Native publication did not commit')
          }
          receipts.push(snapshot)
        }).catch((error: unknown) => { failures.push(error) }))
      },
    },
  }
  const page = (marker: string, withTable = true) => `<script setup>
import { ref } from 'wevu'
${withTable ? 'import PlatformTable from \'conditional-table/PlatformTable.vue\'\nimport ConditionalSetup from \'conditional-table/ConditionalSetup.vue\'' : ''}
import Editable from '../../components/editable.vue'
const marker = ref('${marker}')
</script>
<template><view>{{ marker }}<Editable />${withTable ? '<PlatformTable /><ConditionalSetup />' : ''}</view></template>`
  const editable = (marker: string) => `<template><view>${marker}</view></template>`
  const table = (marker: string) => `<template>
<!-- #ifdef MP-WEIXIN -->
<view class="table">${marker}<active-child><template #default="{ value }"><view>{{ value }}</view></template></active-child></view>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<hidden-child><template #default="{ value }"><view>foreign-only {{ value }}</view></template></hidden-child>
<!-- #endif -->
</template>
<script>
import ActiveChild from './ActiveChild.vue'
import HiddenChild from './HiddenChild.vue'
export default { components: { ActiveChild, HiddenChild } }
</script>
<style>.table { color: red; }</style>`
  const tableBase = 'weapp_vite_external/conditional-table/PlatformTable'
  const activeBase = 'weapp_vite_external/conditional-table/ActiveChild'
  const setupBase = 'weapp_vite_external/conditional-table/ConditionalSetup'
  const setupActiveBase = 'weapp_vite_external/conditional-table/SetupActive'
  const hiddenBase = 'weapp_vite_external/conditional-table/HiddenChild'
  const setupTemplate = (marker: string) => `<view>${marker}<SetupActive /></view>
<!-- #ifndef MP-WEIXIN -->
<HiddenChild /><view>setup-foreign-only</view>
<!-- #endif -->`
  const inspect = async (cursor: number, pageMarker: string, tableMarker: string, editableMarker = 'editable-first', setupMarker = 'setup-first') => {
    const find = () => receipts.slice(cursor).find(snapshot =>
      String(snapshot.outputs.get('pages/index/index.js')).includes(pageMarker)
      && String(snapshot.outputs.get(`${tableBase}.wxml`)).includes(tableMarker)
      && String(snapshot.outputs.get(`${setupBase}.wxml`)).includes(setupMarker)
      && String(snapshot.outputs.get('components/editable.wxml')).includes(editableMarker),
    )
    try {
      await expect.poll(() => Boolean(find()), { timeout: 20_000 }).toBe(true)
    }
    catch (error) {
      const diagnostic = {
        expected: { pageMarker, tableMarker, editableMarker, setupMarker },
        snapshots: receipts.slice(cursor).map(snapshot => ({
          page: String(snapshot.outputs.get('pages/index/index.js')).includes(pageMarker),
          table: String(snapshot.outputs.get(`${tableBase}.wxml`)).includes(tableMarker),
          setup: String(snapshot.outputs.get(`${setupBase}.wxml`)).includes(setupMarker),
          editable: String(snapshot.outputs.get('components/editable.wxml')).includes(editableMarker),
          files: [...snapshot.outputs.keys()].filter(file => /conditional-table|editable/.test(file)),
        })),
        failures: failures.map(String),
      }
      throw new Error(`Native publication did not reach the expected generation: ${JSON.stringify(diagnostic)}`, { cause: error })
    }
    const receipt = find()!
    const json = JSON.parse(String(receipt.outputs.get(`${tableBase}.json`))) as { usingComponents?: Record<string, string> }
    expect(json.usingComponents).toMatchObject({ 'active-child': `/${activeBase}` })
    expect(json.usingComponents).not.toHaveProperty('hidden-child')
    expect(receipt.outputs.get(`${tableBase}.wxml`)).not.toContain('foreign-only')
    const setupJson = JSON.parse(String(receipt.outputs.get(`${setupBase}.json`))) as { usingComponents?: Record<string, string> }
    expect(setupJson.usingComponents).toEqual({ 'setup-active': `/${setupActiveBase}` })
    expect(receipt.outputs.get(`${setupBase}.wxml`)).not.toContain('setup-foreign-only')
    for (const extension of ['js', 'json', 'wxml']) {
      expect(receipt.outputs.has(`${activeBase}.${extension}`), JSON.stringify({ file: `${activeBase}.${extension}`, outputs: [...receipt.outputs.keys()].filter(file => file.includes('conditional-table')), graphObservations })).toBe(true)
      expect((await readFile(path.join(outDir, `${activeBase}.${extension}`))).length).toBeGreaterThan(0)
      expect(receipt.outputs.has(`${setupActiveBase}.${extension}`)).toBe(true)
      expect((await readFile(path.join(outDir, `${setupActiveBase}.${extension}`))).length).toBeGreaterThan(0)
      expect(receipt.outputs.has(`${hiddenBase}.${extension}`), JSON.stringify([...receipt.outputs.keys()].filter(file => file.startsWith(`${hiddenBase}.`)))).toBe(false)
    }
    expect(Object.keys(json.usingComponents ?? {}).some(name => name.startsWith('scoped-slot-'))).toBe(true)
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(receipt.outputs.has(`${tableBase}.${extension}`)).toBe(true)
      expect((await readFile(path.join(outDir, `${tableBase}.${extension}`))).length).toBeGreaterThan(0)
    }
    expect(receipt.outputs.get(`${tableBase}.wxss`)).toMatch(/color:\s*red/)
    for (const [name, component] of Object.entries(json.usingComponents ?? {})) {
      if (name.startsWith('scoped-slot-')) {
        for (const extension of ['js', 'json', 'wxml', 'wxss']) {
          const file = `${component.replace(/^\//, '')}.${extension}`
          expect(receipt.outputs.has(file)).toBe(true)
          await readFile(path.join(outDir, file))
        }
      }
    }
    await inspectClassicPublication(outDir, 'weapp')
    expect(failures).toEqual([])
  }
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'uni-conditional-publication', private: true, type: 'module', dependencies: { wevu: '*' } }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      'src/app.js': 'App({})',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.vue': page('page-first'),
      'src/components/editable.vue': editable('editable-first'),
      'src/components/setup-template.html': setupTemplate('setup-first'),
      'node_modules/conditional-table/package.json': JSON.stringify({ name: 'conditional-table', version: '1.0.0' }),
      'node_modules/conditional-table/PlatformTable.vue': table('wechat-first'),
      'node_modules/conditional-table/ActiveChild.vue': '<script>export default { data() { return { value: "active" } } }</script><template><view><slot :value="value" /></view></template>',
      'node_modules/conditional-table/HiddenChild.vue': '<script>export default { data() { return { value: "hidden" } } }</script><template><view><slot :value="value" /></view></template>',
      'node_modules/conditional-table/ConditionalSetup.vue': '<template src="../../src/components/setup-template.html"></template><script setup src="./setup-script.ts"></script>',
      'node_modules/conditional-table/setup-script.ts': 'import SetupActive from "./SetupActive.vue"\nimport HiddenChild from "./HiddenChild.vue"',
      'node_modules/conditional-table/SetupActive.vue': '<script>export default {}</script><template><view>setup-active</view></template>',
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    for (const [name, target] of [
      ['wevu', path.resolve(path.dirname(fileURLToPath(import.meta.resolve('wevu'))), '..')],
      ['weapp-vite', path.resolve(import.meta.dirname, '../..')],
    ]) {
      await symlink(await realpath(target!), path.join(root, 'node_modules', name!), 'junction')
    }
    const ctx = await session.initialize({
      cwd: root,
      isDev: true,
      mode: 'development',
      inlineConfig: {
        configFile: false,
        logLevel: 'silent',
        plugins: [graphObserver, observer],
        weapp: {
          srcRoot: 'src',
          autoRoutes: false,
          hmr: { runtime: 'classic' },
          uniApp: { include: ['conditional-table'] },
          vue: { template: { scopedSlotsCompiler: 'augmented' } },
        },
      },
    })
    session.onClose(() => ctx.watcherService.closeAll())
    const watcher = await session.run(() => ctx.buildService.build({ skipNpm: true }))
    if (Array.isArray(watcher) || !('on' in watcher)) {
      throw new Error('Classic development compilation did not return its watcher')
    }
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        failures.push(event.error)
      }
    })
    await inspect(0, 'page-first', 'wechat-first')
    const componentCursor = receipts.length
    await writeFile(path.join(root, 'src/components/editable.vue'), editable('editable-second'))
    await inspect(componentCursor, 'page-first', 'wechat-first', 'editable-second')
    const componentRestoreCursor = receipts.length
    await writeFile(path.join(root, 'src/components/editable.vue'), editable('editable-first'))
    await inspect(componentRestoreCursor, 'page-first', 'wechat-first')
    const externalCursor = receipts.length
    await writeFile(path.join(root, 'src/components/setup-template.html'), setupTemplate('setup-second'))
    await inspect(externalCursor, 'page-first', 'wechat-first', 'editable-first', 'setup-second')
    const externalRestoreCursor = receipts.length
    await writeFile(path.join(root, 'src/components/setup-template.html'), setupTemplate('setup-first'))
    await inspect(externalRestoreCursor, 'page-first', 'wechat-first')
    const pageCursor = receipts.length
    await writeFile(path.join(root, 'src/pages/index/index.vue'), page('page-second'))
    await inspect(pageCursor, 'page-second', 'wechat-first')
    const restoreCursor = receipts.length
    await writeFile(path.join(root, 'src/pages/index/index.vue'), page('page-first'))
    await inspect(restoreCursor, 'page-first', 'wechat-first')
    const removeCursor = receipts.length
    await writeFile(path.join(root, 'src/pages/index/index.vue'), page('page-without-table', false))
    await expect.poll(() => receipts.slice(removeCursor).some(snapshot =>
      String(snapshot.outputs.get('pages/index/index.js')).includes('page-without-table'),
    ), { timeout: 20_000 }).toBe(true)
    const removed = receipts.slice(removeCursor).find(snapshot =>
      String(snapshot.outputs.get('pages/index/index.js')).includes('page-without-table'),
    )!
    expect(removed.outputs.has(`${tableBase}.wxml`)).toBe(false)
    expect(removed.outputs.has(`${activeBase}.wxml`)).toBe(false)
    expect(removed.outputs.has(`${setupBase}.wxml`)).toBe(false)
    expect(removed.outputs.has(`${setupActiveBase}.wxml`)).toBe(false)
    await inspectClassicPublication(outDir, 'weapp')
    await rm(path.join(root, 'node_modules/conditional-table/PlatformTable.vue'))
    const deleteCursor = receipts.length
    await writeFile(path.join(root, 'src/pages/index/index.vue'), page('page-after-delete', false))
    await expect.poll(() => receipts.slice(deleteCursor).some(snapshot =>
      String(snapshot.outputs.get('pages/index/index.js')).includes('page-after-delete'),
    ), { timeout: 20_000 }).toBe(true)
    const deleted = receipts.slice(deleteCursor).find(snapshot =>
      String(snapshot.outputs.get('pages/index/index.js')).includes('page-after-delete'),
    )!
    const pageConfig = JSON.parse(String(deleted.outputs.get('pages/index/index.json'))) as { usingComponents?: Record<string, string> }
    expect(Object.values(pageConfig.usingComponents ?? {})).not.toContain(`/${tableBase}`)
    expect(deleted.outputs.has(`${tableBase}.wxml`)).toBe(false)
    await inspectClassicPublication(outDir, 'weapp')
  }
  finally {
    try {
      await session.close()
      await Promise.all(observations)
      expect(failures).toEqual([])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 90_000)
