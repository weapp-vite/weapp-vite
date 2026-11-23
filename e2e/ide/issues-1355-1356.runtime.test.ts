import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildNpmArtifactFixture, NPM_ARTIFACT_FIXTURE, prepareNpmArtifactFixture } from '../utils/npmArtifactFixture'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const ROUTE = '/pages/index/index'

describe('issues #1355 / #1356 / #1370 emitted npm artifact runtime', () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await prepareNpmArtifactFixture()
    const { output, observations } = await buildNpmArtifactFixture(project, 'dist-runtime-prune', 'runtime-prune')
    expect(observations).toEqual({ writeBundle: true, closeBundle: true })
    const stylesheet = await readFile(path.join(output, 'miniprogram_npm/mini-lib/icon/index.wxss'), 'utf8')
    expect(stylesheet).toContain('artifact observer completed')
    const tslib = await readFile(path.join(output, 'miniprogram_npm/tslib/index.js'), 'utf8')
    expect(tslib).toContain('__rest')
    host = await launchAutomator({ projectPath: output, warmupRoute: ROUTE, warmupRootSelectors: ['#npm-artifact-page'] })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: async () => { await host?.close() },
      stopDev: () => {},
    })
  })

  it('renders the npm component, handles events and remains correct on reentry', async (context) => {
    const nodes = [
      { selector: '#npm-artifact-page', count: 1 },
      { selector: 'component', has: '#npm-artifact-icon', text: 'npm artifact readycross-package dependency retained' },
    ]
    const acceptance = createDomAcceptance(context, NPM_ARTIFACT_FIXTURE, [
      { id: 'initial', route: ROUTE, action: '检查第二份产物中的 npm 组件首次渲染', nodes: [...nodes, { selector: '#count', text: 'count: 0' }] },
      { id: 'incremented', route: ROUTE, action: '检查组件共存时页面事件正常更新', nodes: [...nodes, { selector: '#count', text: 'count: 1' }] },
      { id: 'reentry', route: ROUTE, action: '重新进入后 npm 组件仍然可用', nodes: [...nodes, { selector: '#count', text: 'count: 0' }] },
    ])
    const errors = attachRuntimeErrorCollector(host!)
    try {
      const page = (await host!.currentPage())!
      await acceptance.check('initial', host!, page)
      await (await page.$('#increment'))!.tap()
      await acceptance.check('incremented', host!, page)
      await acceptance.check('reentry', host!, await host!.reLaunch(ROUTE))
      expect(errors.getSince(0)).toEqual([])
      // headless 提供相同 DOM 与事件契约；截图仅由真实 IDE 的图形宿主提供。
      if (resolveRuntimeProviderName() === 'devtools') {
        const screenshot = await host!.screenshot({})
        expect(screenshot).toBeTruthy()
      }
    }
    finally {
      errors.dispose()
    }
  })
})
