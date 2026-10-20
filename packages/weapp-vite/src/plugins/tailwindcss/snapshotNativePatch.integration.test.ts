import type { OutputAsset, OutputChunk } from 'rolldown'
import type { Definition } from '../../runtime/statefulHmr/runtimeTestHost'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import postcss from 'postcss'
import { expect, it, vi } from 'vitest'
import { compileHmrBatch } from '../../runtime/statefulHmr/compileBatch'
import { bundleHmrCode, prepareHmrPatch } from '../../runtime/statefulHmr/patchPreparation'
import { createHost, createRuntime } from '../../runtime/statefulHmr/runtimeTestHost'
import { fixture, observations } from './snapshotGeneration/fixture'

const nativePage = `const utility = 'bg-[#fce7f3]'
const marker = 'SNAPSHOT_BASE'
Page({
  data: { count: 0, utility, marker },
  increment() {
    this.setData({ count: this.data.count + 1, utility, marker })
  },
})`

function backgroundClasses(css: string, color: string) {
  const classes: string[] = []
  postcss.parse(css).walkDecls('background-color', (declaration) => {
    if (declaration.value === color && declaration.parent?.type === 'rule') {
      classes.push(...postcss.list.comma(declaration.parent.selector).filter(selector => selector.startsWith('.')).map(selector => selector.slice(1)))
    }
  })
  return classes
}

it('keeps native method closures, payload utilities and CSS aligned after config snapshots', async () => {
  const template = '<view class="bg-[#fce7f3]">fixed utility</view><view class="{{ utility }}">{{ marker }}</view>'
  const app = await fixture(false, false, false, { script: nativePage, template })
  const source = path.join(app.root, 'src/pages/index/index.ts')
  // VM 验证编译投影及原生方法闭包；DevEngine 失效图和真实 DOM 仍由 runtime E2E 覆盖。
  const runtime = createRuntime()
  const definitions: Definition[] = []
  const evaluate = (code: string) => runInNewContext(code, {
    Page: (definition: Definition) => {
      const registered = runtime.bridge.Page(definition)
      if (registered) {
        definitions.push(registered)
      }
    },
  })
  const captureConfig = async (title: string) => {
    const code = JSON.stringify({ pages: ['pages/index/index'], window: { navigationBarTitleText: title } })
    await writeFile(app.app, code)
    app.host.capture(app.app, code)
    const input = app.host.freeze([app.app])
    return { input, preparations: await app.host.prepare(input) }
  }
  const initial = await captureConfig('SNAPSHOT_BASE')
  const built = await app.compile(initial)
  const initialOutputs = built.snapshot!.output
  const initialStyle = initialOutputs.find(output => output.fileName === 'app.wxss') as OutputAsset
  const initialScript = initialOutputs.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
  const initialTemplate = initialOutputs.find(output => output.fileName === 'pages/index/index.wxml') as OutputAsset
  const classes = backgroundClasses(String(initialStyle.source), '#fce7f3')
  expect(classes.length).toBeGreaterThan(0)
  expect(classes.some(name => initialScript.code.includes(name) && String(initialTemplate.source).includes(name))).toBe(true)
  const prepared = await prepareHmrPatch({ type: 'Patch', code: nativePage, filename: 'initial.js' }, initial.preparations, {
    filename: 'initial.js',
    resolveImport: value => value,
  }, false)
  evaluate(bundleHmrCode([prepared]))
  await built.dispose()
  const definition = definitions[0]!
  const page = createHost()
  definition.onLoad!.call(page)
  definition.increment!.call(page)
  const data = () => page.data as typeof page.data & { utility: string, marker: string }
  expect(data()).toMatchObject({ count: 1, marker: 'SNAPSHOT_BASE' })
  expect(classes).toContain(data().utility)

  for (const title of ['SNAPSHOT_CONFIG', 'SNAPSHOT_BASE']) {
    const config = await app.compile(await captureConfig(title))
    try {
      const output = config.snapshot!.output
      const json = output.find(output => output.fileName === 'app.json') as OutputAsset
      const style = output.find(output => output.fileName === 'app.wxss') as OutputAsset
      const script = output.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
      const template = output.find(output => output.fileName === 'pages/index/index.wxml') as OutputAsset
      expect(JSON.parse(String(json.source)) as unknown).toMatchObject({ window: { navigationBarTitleText: title } })
      expect(backgroundClasses(String(style.source), '#fce7f3')).toContain(data().utility)
      expect(script.code).toContain(data().utility)
      expect(String(template.source)).toContain(data().utility)
      expect(config.code).toBe('')
      expect(data()).toMatchObject({ count: 1, marker: 'SNAPSHOT_BASE' })
    }
    finally {
      await config.dispose()
    }
  }
  expect(observations().instances.slice(1).map(instance => instance.requests.length)).toEqual([0, 0, 0])

  for (const [stage, code, color, marker, count] of [
    ['patched', nativePage.replace('#fce7f3', '#dbeafe').replace('SNAPSHOT_BASE', 'SNAPSHOT_UPDATED').replace('this.data.count + 1', 'this.data.count + 2'), '#dbeafe', 'SNAPSHOT_UPDATED', 3],
    ['restored', nativePage, '#fce7f3', 'SNAPSHOT_BASE', 4],
  ] as const) {
    await writeFile(source, code)
    app.host.capture(source, code)
    const input = app.host.freeze([source])
    const compiled = await compileHmrBatch({
      ctx: app.owner,
      input,
      needsSnapshot: false,
      patches: [{ clientId: 'native-snapshot-test', update: { type: 'Patch', filename: 'update.js', code, changedIds: [source] } }],
      prepareProviders: () => app.host.prepare(input),
      rebuild: async (_files, sources) => app.snapshot(sources),
      sourcemap: false,
    })
    try {
      const css = compiled.compilerAssets.find(asset => asset.fileName === 'app.wxss')!.code
      const selectors = backgroundClasses(css, color)
      expect(selectors.length).toBeGreaterThan(0)
      expect(compiled.code).toContain(marker)
      runtime.bridge.beginUpdate()
      try {
        evaluate(compiled.code)
      }
      finally {
        runtime.finishUpdate()
      }
      expect(definitions.at(-1)).toBe(definition)
      expect(data().count).toBe(count === 3 ? 1 : 3)
      definition.increment!.call(page)
      const observed = { stage, selectors, utility: data().utility, payloadIncludesUtility: compiled.code.includes(data().utility), setData: vi.mocked(page.setData).mock.calls.at(-1) }
      expect(data(), JSON.stringify(observed)).toMatchObject({ count, marker })
      expect(selectors, JSON.stringify(observed)).toContain(data().utility)
      expect(compiled.code, JSON.stringify(observed)).toContain(data().utility)
      expect(page.setData).toHaveBeenLastCalledWith({ count, utility: data().utility, marker })
      expect(definitions).toHaveLength(1)
      if (stage === 'restored') {
        expect(backgroundClasses(css, '#dbeafe')).toEqual([])
      }
    }
    finally {
      await compiled.dispose()
    }
  }
  expect(runtime.instanceCount()).toBe(1)
})
