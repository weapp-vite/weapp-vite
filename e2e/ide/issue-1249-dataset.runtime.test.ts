import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1249'
const ROUTE = '/pages/index/index'

function expected(value: string, count: number, component = false) {
  return {
    item: { id: 'same', value, nested: { count } },
    index: component ? 1 : 0,
    enabled: false,
    literal: '0',
    mixed: component ? 'component-1' : 'row-0',
  }
}

function nodes(kind: string, value: string, count: number, component = false) {
  const index = component ? 1 : 0
  const mixed = component ? 'component-1' : 'row-0'
  return [{ selector: '#dataset-summary', text: `${kind}|object|${value}|${count}|number|${index}|boolean|false|string|0|string|${mixed}` }]
}

describe('issue #1249: native dataset object consumers', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1249)
    await buildIssueRegressionProject(project, 'weapp')
    const config = JSON.parse(await readFile(path.join(project, 'project.config.json'), 'utf8')) as { miniprogramRoot: string }
    const output = path.resolve(project, config.miniprogramRoot)
    const app = JSON.parse(await readFile(path.join(output, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    for (const entry of [...app.pages, 'components/datasetProbe/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(output, `${entry}.${extension}`))
      }
    }
    host = await launchAutomator({ projectPath: project, warmupRoute: ROUTE, warmupRootSelectors: ['#row-0'] })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({ project, closeSession: () => host?.close(), stopDev: () => {} })
  }, 120_000)

  it('preserves object, zero, false and static or mixed strings across replacement and every consumer', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTE, action: '原生页面显示对象 dataset 列表', nodes: [{ selector: '#row-0', text: 'Select 0' }] },
      { id: 'event-initial', route: ROUTE, action: '原生 tap 读取初始表达式原值', nodes: nodes('event', 'pending', 1) },
      { id: 'selector-initial', route: ROUTE, action: 'selector 读取初始表达式原值', nodes: nodes('selector', 'pending', 1) },
      { id: 'observer-initial', route: ROUTE, action: 'observer 读取初始表达式原值', nodes: nodes('observer', 'pending', 1) },
      { id: 'component-initial', route: ROUTE, action: '组件事件读取宿主表达式原值', nodes: nodes('component', 'pending', 1, true) },
      { id: 'event-replaced', route: ROUTE, action: '同 key 对象替换后 tap 读取新值', nodes: nodes('event', 'complete', 2) },
      { id: 'selector-replaced', route: ROUTE, action: 'selector 读取替换后的新值', nodes: nodes('selector', 'complete', 2) },
      { id: 'observer-replaced', route: ROUTE, action: 'observer 读取替换后的新值', nodes: nodes('observer', 'complete', 2) },
      { id: 'component-replaced', route: ROUTE, action: '组件事件读取替换后的宿主新值', nodes: nodes('component', 'complete', 2, true) },
    ])
    const page = await host!.reLaunch(ROUTE)
    const tap = async (selector: string) => {
      const element = await page.$(selector)
      expect(element).toBeTruthy()
      await element!.tap()
    }
    const tapComponent = async () => {
      const component = await page.$('#component-probe')
      expect(component).toBeTruthy()
      const element = await component!.$('#emit-select')
      expect(element).toBeTruthy()
      await element!.tap()
    }
    const read = async (key: string) => {
      const snapshot: unknown = await page.data(key)
      expect(typeof snapshot).toBe('string')
      return JSON.parse(snapshot as string) as unknown
    }
    await dom.check('initial', host!, page)
    await tap('#row-0')
    await dom.check('event-initial', host!, page)
    expect(await read('snapshot')).toMatchObject(expected('pending', 1))
    await tap('#query')
    await dom.check('selector-initial', host!, page)
    expect(await read('selector')).toMatchObject(expected('pending', 1))
    await tap('#observe')
    await dom.check('observer-initial', host!, page)
    expect(await read('observer')).toMatchObject(expected('pending', 1))
    await tapComponent()
    await dom.check('component-initial', host!, page)
    expect(await read('snapshot')).toMatchObject(expected('pending', 1, true))
    await tap('#replace')
    await tap('#row-0')
    await dom.check('event-replaced', host!, page)
    expect(await read('snapshot')).toMatchObject(expected('complete', 2))
    await tap('#query')
    await dom.check('selector-replaced', host!, page)
    expect(await read('selector')).toMatchObject(expected('complete', 2))
    await tap('#observe')
    await dom.check('observer-replaced', host!, page)
    expect(await read('observer')).toMatchObject(expected('complete', 2))
    await tapComponent()
    await dom.check('component-replaced', host!, page)
    expect(await read('snapshot')).toMatchObject(expected('complete', 2, true))
  })
})
