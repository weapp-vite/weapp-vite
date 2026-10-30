import type { NativeSelectorAttachmentSnapshot } from '../../mpcore/packages/simulator/test/helpers/nativeSelectorAttachment'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initialPropertyDeliveryFiles } from '../../mpcore/packages/simulator/test/helpers/initialPropertyDelivery'
import { nativeBarePropertiesFiles } from '../../mpcore/packages/simulator/test/helpers/nativeBareProperties'
import { nativeSelectorAttachmentFiles, nativeSelectorAttachmentLeafIds } from '../../mpcore/packages/simulator/test/helpers/nativeSelectorAttachment'
import { assertPropertyDeliveryEvents } from '../../mpcore/packages/simulator/test/helpers/propertyDeliveryAssertions'
import { assertNativeSelectorAttachment } from '../../mpcore/packages/simulator/test/helpers/selectorAttachmentAssertions'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = '/pages/index/index'
const BARE_ROUTE = '/bare-probe/pages/index/index'
const SELECTOR_ROUTE = '/selector-probe/pages/index/index'

describe('native component property delivery parity', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
  let miniProgram: any

  beforeAll(async () => {
    fixture = await createStatefulHmrProject(ROOT)
    const configFile = path.join(fixture.projectRoot, 'project.config.json')
    const config = await fs.readJson(configFile) as Record<string, unknown>
    for (const [file, contents] of initialPropertyDeliveryFiles) {
      if (file === 'project.config.json') {
        continue
      }
      const target = path.join(fixture.projectRoot, 'native-probe', file)
      await fs.ensureDir(path.dirname(target))
      await fs.writeFile(target, contents)
    }
    for (const [file, contents] of nativeBarePropertiesFiles) {
      if (['project.config.json', 'app.json', 'app.js'].includes(file)) {
        continue
      }
      const target = path.join(fixture.projectRoot, 'native-probe/bare-probe', file)
      await fs.ensureDir(path.dirname(target))
      await fs.writeFile(target, file === 'pages/index/index.json'
        ? contents.replaceAll('"/components/', '"/bare-probe/components/')
        : contents)
    }
    for (const [file, contents] of nativeSelectorAttachmentFiles) {
      if (['project.config.json', 'app.json', 'app.js'].includes(file)) {
        continue
      }
      const target = path.join(fixture.projectRoot, 'native-probe/selector-probe', file)
      await fs.ensureDir(path.dirname(target))
      await fs.writeFile(target, contents.replaceAll('"/components/', '"/selector-probe/components/'))
    }
    await fs.writeJson(path.join(fixture.projectRoot, 'native-probe/app.json'), {
      pages: [ROUTE.slice(1), BARE_ROUTE.slice(1), SELECTOR_ROUTE.slice(1)],
    }, { spaces: 2 })
    await fs.writeJson(configFile, { ...config, miniprogramRoot: 'native-probe/', srcMiniprogramRoot: 'native-probe/' }, { spaces: 2 })
    await fs.writeJson(path.join(fixture.projectRoot, 'project.private.config.json'), {
      condition: { miniprogram: { list: [
        { id: 0, name: 'initial property delivery', pathName: ROUTE.slice(1), query: '' },
        { id: 1, name: 'valueless property delivery', pathName: BARE_ROUTE.slice(1), query: '' },
        { id: 2, name: 'attached selector query', pathName: SELECTOR_ROUTE.slice(1), query: '' },
      ] } },
    }, { spaces: 2 })
    miniProgram = await launchAutomator({
      projectPath: fixture.projectRoot,
      launchMode: 'bridge',
      trustProject: true,
      timeout: 120_000,
      warmupRoute: ROUTE,
      warmupRootSelectors: ['.probe-value'],
      bridgeProjectMode: 'direct',
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      closeSession: async () => { await miniProgram?.close() },
      stopDev: () => {},
    })
    await fixture?.cleanup()
  }, 120_000)

  it('shares native data and properties and delivers batched, same-value and changed writes', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [
      { id: 'initial', route: ROUTE, action: '读取原生初始属性交付事件', nodes: [
        { selector: '.probe-value', text: 'OWNER:SLOT-READY' },
        { selector: '.component-value', scope: ['#probe'], text: 'OWNER:SLOT-READY' },
      ] },
      { id: 'updated', route: ROUTE, action: '读取原生批量属性交付事件', nodes: [
        { selector: '.probe-value', text: 'OWNER-UPDATED:SLOT-UPDATED' },
        { selector: '.component-value', scope: ['#probe'], text: 'OWNER-UPDATED:SLOT-UPDATED' },
      ] },
      { id: 'self-written', route: ROUTE, action: '读取原生自身属性写入和同值更新事件', nodes: [
        { selector: '.probe-value', text: 'OWNER-UPDATED:SLOT-UPDATED' },
        { selector: '.component-value', scope: ['#probe'], text: 'SELF-CHANGED:SLOT-UPDATED' },
      ] },
    ])
    async function checkEvents(stage: 'initial' | 'updated' | 'self-written') {
      const events = await miniProgram.evaluate(() => (getApp() as any).globalData.propertyEvents)
      assertPropertyDeliveryEvents(events, stage)
    }
    await dom.check('initial', miniProgram, await miniProgram.currentPage())
    await checkEvents('initial')
    await (await miniProgram.currentPage()).callMethod('updateBoth')
    await dom.check('updated', miniProgram, await miniProgram.currentPage())
    await checkEvents('updated')
    await (await miniProgram.currentPage()).callMethod('writeSelf')
    await dom.check('self-written', miniProgram, await miniProgram.currentPage())
    await checkEvents('self-written')
  }, 180_000)

  it('distinguishes valueless properties from explicit empty, null and omitted values', async (ctx) => {
    const initial = [
      ['bare', 'boolean:true'],
      ['empty', 'string:'],
      ['bound-empty', 'string:'],
      ['null', 'null'],
      ['undefined', 'null'],
      ['omitted', 'string:fallback'],
      ['true', 'boolean:true'],
      ['false', 'boolean:false'],
      ['included', 'boolean:true'],
      ['behavior-bare', 'boolean:true'],
      ['behavior-bound', 'string:'],
      ['behavior-default', 'string:nested-fallback'],
    ].map(([id, text]) => ({ selector: '.bare-summary', scope: [`#${id}`], text }))
    const stable = [
      { selector: '.camel-summary', scope: ['#camel'], text: 'boolean:true' },
      { selector: '.unknown-summary', scope: ['#unknown'], text: 'false' },
      { selector: '.camel-summary', scope: ['#behavior-bare'], text: 'boolean:true' },
      { selector: '.camel-summary', scope: ['#behavior-bound'], text: 'boolean:true' },
      { selector: '.camel-summary', scope: ['#behavior-default'], text: 'boolean:false' },
      { selector: '//*[contains(@class,"loop-probe")]//*[contains(@class,"bare-summary")]', query: 'xpath' as const, count: 2, text: 'boolean:true' },
    ]
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [
      { id: 'bare-initial', route: BARE_ROUTE, action: '区分裸属性和显式空值', nodes: [...initial, ...stable] },
      { id: 'bare-updated', route: BARE_ROUTE, action: '更新绑定值并保留裸属性', nodes: [
        { selector: '.bare-summary', scope: ['#bound-empty'], text: 'string:changed' },
        { selector: '.bare-summary', scope: ['#bare'], text: 'boolean:true' },
        { selector: '.bare-summary', scope: ['#empty'], text: 'string:' },
        { selector: '.bare-summary', scope: ['#behavior-bound'], text: 'string:changed' },
        { selector: '.bare-summary', scope: ['#behavior-bare'], text: 'boolean:true' },
        ...stable,
      ] },
      { id: 'bare-restored', route: BARE_ROUTE, action: '恢复绑定空字符串', nodes: [...initial, ...stable] },
    ])
    const page = await miniProgram.reLaunch(BARE_ROUTE)
    await dom.check('bare-initial', miniProgram, page)
    await page.callMethod('update', 'changed')
    await dom.check('bare-updated', miniProgram, page)
    await page.callMethod('update', '')
    await dom.check('bare-restored', miniProgram, page)
  }, 180_000)

  it('queries component roots during attachment and after slot projection changes', async (ctx) => {
    const page = await miniProgram.reLaunch(SELECTOR_ROUTE)
    const dom = createDomAcceptance(ctx, 'e2e-apps/stateful-hmr', [
      { id: 'query-closed', route: SELECTOR_ROUTE, action: '查询初始组件自身节点', nodes: [{ selector: '.query-root', scope: ['#visible-regular'], text: 'visible-regular' }] },
      { id: 'query-open', route: SELECTOR_ROUTE, action: '投影默认槽位后再次查询', nodes: [{ selector: '.query-root', scope: ['#visible-regular'], text: 'visible-regular' }] },
      { id: 'query-restored', route: SELECTOR_ROUTE, action: '关闭槽位后再次查询', nodes: [{ selector: '.query-root', scope: ['#visible-regular'], text: 'visible-regular' }] },
    ])
    const phases: Array<{ phase: string, open: boolean }> = []
    for (const [index, [checkpoint, open]] of ([['query-closed', false], ['query-open', true], ['query-restored', false]] as const).entries()) {
      let phase = 'attached'
      if (index > 0) {
        await page.callMethod('toggle', open)
        phase = await page.callMethod('probe')
      }
      phases.push({ phase, open })
      let snapshot: NativeSelectorAttachmentSnapshot
      await expect.poll(async () => {
        snapshot = await page.callMethod('snapshot') as NativeSelectorAttachmentSnapshot
        return nativeSelectorAttachmentLeafIds.every(id => snapshot.leaves[id]?.queries.some(query => query.phase === phase))
      }, { timeout: 30_000 }).toBe(true)
      assertNativeSelectorAttachment(snapshot!, phases)
      await dom.check(checkpoint, miniProgram, page)
    }
  }, 180_000)
})
