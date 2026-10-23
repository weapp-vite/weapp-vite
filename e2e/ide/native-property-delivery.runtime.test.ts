import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { initialPropertyDeliveryFiles } from '../../mpcore/packages/simulator/test/helpers/initialPropertyDelivery'
import { assertPropertyDeliveryEvents } from '../../mpcore/packages/simulator/test/helpers/propertyDeliveryAssertions'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createStatefulHmrProject } from '../utils/statefulHmrProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = '/pages/index/index'

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
    await fs.writeJson(configFile, { ...config, miniprogramRoot: 'native-probe/', srcMiniprogramRoot: 'native-probe/' }, { spaces: 2 })
    await fs.writeJson(path.join(fixture.projectRoot, 'project.private.config.json'), {
      condition: { miniprogram: { list: [{ id: 0, name: 'initial property delivery', pathName: 'pages/index/index', query: '' }] } },
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
})
