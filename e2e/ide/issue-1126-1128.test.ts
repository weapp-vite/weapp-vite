import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createCombinedIssueRegressionProject } from '../utils/issueRegressionProject'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const STYLE_ROUTE = '/pages/index/index'
const EVENT_ROUTE = '/pages/issue-1127/index'
const PROP_ROUTE = '/pages/issue-1128/index'
const visual = resolveRuntimeProviderName() === 'devtools'

describe('issues #1126–1128: native runtime parity', { concurrent: false }, () => {
  let project: string
  let miniProgram: MiniProgram | undefined
  const runtimeErrors: string[] = []

  beforeAll(async () => {
    project = await createCombinedIssueRegressionProject()
    await buildIssueRegressionProject(project, 'weapp')
    const config = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(config.pages).toEqual([STYLE_ROUTE, EVENT_ROUTE, PROP_ROUTE].map(route => route.slice(1)))
    for (const page of config.pages) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect((await stat(path.join(project, `dist/${page}.${extension}`))).isFile()).toBe(true)
      }
    }
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: STYLE_ROUTE,
      warmupRootSelectors: ['button'],
    })
    miniProgram.on('exception', event => runtimeErrors.push(event.message))
  }, 180_000)

  afterEach(() => {
    expect(runtimeErrors).toEqual([])
  })

  afterAll(async () => {
    try {
      await miniProgram?.close()
    }
    finally {
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 60_000)

  it('1126.native-primary', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1126', [
      {
        id: 'initial',
        route: STYLE_ROUTE,
        action: '检查 App 外部和内联样式及页面覆盖',
        nodes: [
          { selector: '#global-probe', ...(visual ? { styles: { 'color': 'rgb(231, 17, 83)', 'font-size': '32px' } } : {}) },
          { selector: '#inline-probe', ...(visual ? { styles: { 'margin-left': '19px' } } : {}) },
          { selector: '#local-probe', ...(visual ? { styles: { color: 'rgb(15, 121, 37)' } } : {}) },
          { selector: '#counter', text: '0' },
        ],
      },
      { id: 'updated', route: STYLE_ROUTE, action: '检查样式场景中的真实点击和状态更新', nodes: [{ selector: '#counter', text: '1' }] },
    ])
    const page = await miniProgram!.reLaunch(STYLE_ROUTE)
    await dom.check('initial', miniProgram!, page)
    const button = await page.$('#increment')
    if (!button) {
      throw new Error('Missing increment button')
    }
    await button.tap()
    await dom.check('updated', miniProgram!, page)
  })

  it('1126.native-boundary', async (context) => {
    // headless 验收主题选择的逻辑节点变化；计算样式仅由真实 IDE 提供。
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1126', [{
      id: 'isolation',
      route: STYLE_ROUTE,
      action: '检查默认隔离、显式隔离和全局样式共享边界',
      nodes: [
        ...['isolated', 'default-isolation'].map(id => ({
          scope: [`#${id}`],
          selector: '#box',
          ...(visual ? { styles: { 'padding-left': '0px' } } : {}),
        })),
        ...['apply-shared', 'shared', 'global-class'].map(id => ({
          scope: [`#${id}`],
          selector: '#box',
          ...(visual ? { styles: { 'padding-left': '13px' } } : {}),
        })),
        ...['isolated', 'apply-shared', 'shared', 'global-class'].map(id => ({
          scope: [`#${id}`],
          selector: '#theme',
          ...(visual ? { styles: { color: 'rgb(23, 91, 167)' } } : {}),
        })),
        { selector: '#local-theme', attributes: { class: 'local-theme' } },
        {
          scope: ['#local-theme-probe'],
          selector: '#theme',
          ...(visual ? { styles: { color: 'rgb(157, 47, 113)' } } : {}),
        },
      ],
    }, {
      id: 'theme-inherited',
      route: STYLE_ROUTE,
      action: '关闭局部主题后恢复应用主题继承',
      nodes: [
        { selector: '#local-theme.local-theme', count: 0 },
        {
          scope: ['#local-theme-probe'],
          selector: '#theme',
          ...(visual ? { styles: { color: 'rgb(23, 91, 167)' } } : {}),
        },
      ],
    }])
    const page = await miniProgram!.reLaunch(STYLE_ROUTE)
    await dom.check('isolation', miniProgram!, page)
    const toggle = await page.$('#toggle-theme')
    if (!toggle) {
      throw new Error('Missing theme toggle')
    }
    await toggle.tap()
    await dom.check('theme-inherited', miniProgram!, page)
  })

  it('1127.native-primary', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1127', [
      { id: 'initial', route: EVENT_ROUTE, action: '检查组件事件初始计数', nodes: [{ selector: '#custom-count', text: '0' }] },
      { id: 'clicked', route: EVENT_ROUTE, action: '点击内部按钮仅触发一次父组件自定义 click', nodes: [{ selector: '#custom-count', text: '1' }] },
    ])
    const page = await miniProgram!.reLaunch(EVENT_ROUTE)
    await dom.check('initial', miniProgram!, page)
    const probe = await page.$('#emit-probe')
    const button = await probe?.$('#emit-click')
    if (!button) {
      throw new Error('Missing component emit button')
    }
    await button.tap()
    await dom.check('clicked', miniProgram!, page)
  })

  it('1127.native-boundary', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1127', [
      { id: 'detail', route: EVENT_ROUTE, action: '保留组件事件 detail', nodes: [{ selector: '#custom-detail', text: 'kept-detail:7' }] },
      {
        id: 'private',
        route: EVENT_ROUTE,
        action: '默认私有事件不进入捕获或冒泡阶段',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'direct' },
          { scope: ['#signal-boundary'], selector: '#signal-detail', text: '11' },
          { selector: '#page-signal-count', text: '0' },
        ],
      },
      {
        id: 'capture-only',
        route: EVENT_ROUTE,
        action: '显式捕获独立于默认关闭的冒泡',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'capture,direct' },
          { scope: ['#signal-boundary'], selector: '#signal-detail', text: '19' },
          { selector: '#page-signal-count', text: '0' },
        ],
      },
      {
        id: 'local',
        route: EVENT_ROUTE,
        action: '未 composed 的冒泡事件不跨组件边界',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'capture,direct,bubble' },
          { selector: '#page-signal-count', text: '0' },
        ],
      },
      {
        id: 'public',
        route: EVENT_ROUTE,
        action: '显式 composed 事件保留捕获、直接处理和冒泡顺序',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'capture,direct,bubble' },
          { selector: '#page-signal-count', text: '1' },
          { selector: '#page-signal-detail', text: '37' },
        ],
      },
      {
        id: 'caught',
        route: EVENT_ROUTE,
        action: 'catch 保留先前捕获并阻止后续冒泡',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'capture,catch' },
          { selector: '#page-signal-count', text: '1' },
        ],
      },
      {
        id: 'capture-caught',
        route: EVENT_ROUTE,
        action: 'capture-catch 阻止后续直接处理和冒泡',
        nodes: [
          { scope: ['#signal-boundary'], selector: '#signal-trace', text: 'capture,capture-catch' },
          { selector: '#page-signal-count', text: '1' },
        ],
      },
    ])
    const page = await miniProgram!.reLaunch(EVENT_ROUTE)
    const probe = await page.$('#emit-probe')
    const payload = await probe?.$('#emit-payload')
    if (!payload) {
      throw new Error('Missing component payload button')
    }
    await payload.tap()
    await dom.check('detail', miniProgram!, page)
    const boundary = await page.$('#signal-boundary')
    const signal = await boundary?.$('#open-signal')
    const privateEvent = await signal?.$('#emit-private')
    const captureOnly = await signal?.$('#emit-capture')
    const local = await signal?.$('#emit-local')
    const reset = await boundary?.$('#reset-signal')
    const publicEvent = await signal?.$('#emit-public')
    const caught = await boundary?.$('#caught-signal')
    const caughtEvent = await caught?.$('#emit-public')
    const captureCaught = await boundary?.$('#capture-caught-signal')
    const captureCaughtEvent = await captureCaught?.$('#emit-public')
    if (!privateEvent || !captureOnly || !local || !reset || !publicEvent || !caughtEvent || !captureCaughtEvent) {
      throw new Error('Missing component bubbling controls')
    }
    await privateEvent.tap()
    await dom.check('private', miniProgram!, page)
    await reset.tap()
    await captureOnly.tap()
    await dom.check('capture-only', miniProgram!, page)
    await reset.tap()
    await local.tap()
    await dom.check('local', miniProgram!, page)
    await reset.tap()
    await publicEvent.tap()
    await dom.check('public', miniProgram!, page)
    await reset.tap()
    await caughtEvent.tap()
    await dom.check('caught', miniProgram!, page)
    await reset.tap()
    await captureCaughtEvent.tap()
    await dom.check('capture-caught', miniProgram!, page)
  })

  it('1128.native-primary', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1128', [{
      id: 'defaults',
      route: PROP_ROUTE,
      action: '同名 setup 方法不改变省略、显式 false 和显式 true 的 prop 分支',
      nodes: [
        ...['default-probe', 'explicit-false-probe'].flatMap(id => [
          { scope: [`#${id}`], selector: '#false-branch', count: 1 },
          { scope: [`#${id}`], selector: '#true-branch', count: 0 },
        ]),
        { scope: ['#explicit-true-probe'], selector: '#true-branch', count: 1 },
        { scope: ['#explicit-true-probe'], selector: '#false-branch', count: 0 },
      ],
    }])
    const page = await miniProgram!.reLaunch(PROP_ROUTE)
    await dom.check('defaults', miniProgram!, page)
  })

  it('1128.native-boundary', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1128', [
      {
        id: 'called',
        route: PROP_ROUTE,
        action: '同名处理函数可调用且不改写 false prop',
        nodes: [
          { scope: ['#default-probe'], selector: '#handler-count', text: '1' },
          { scope: ['#default-probe'], selector: '#false-branch', count: 1 },
          { scope: ['#updated-probe'], selector: '#false-branch', count: 1 },
        ],
      },
      {
        id: 'true',
        route: PROP_ROUTE,
        action: '父组件响应式更新为 true',
        nodes: [
          { scope: ['#updated-probe'], selector: '#true-branch', count: 1 },
          { scope: ['#updated-probe'], selector: '#false-branch', count: 0 },
        ],
      },
      {
        id: 'false',
        route: PROP_ROUTE,
        action: '父组件响应式更新回 false',
        nodes: [
          { scope: ['#updated-probe'], selector: '#false-branch', count: 1 },
          { scope: ['#updated-probe'], selector: '#true-branch', count: 0 },
        ],
      },
      {
        id: 'typed-updated',
        route: PROP_ROUTE,
        action: '父级更新保持 String、Number、Object、Array 输入值',
        nodes: [
          { scope: ['#variant-probe'], selector: '#string-value', text: 'string-updated' },
          { scope: ['#variant-probe'], selector: '#number-value', text: '12' },
          { scope: ['#variant-probe'], selector: '#object-value', text: 'object-updated' },
          { scope: ['#variant-probe'], selector: '#array-value', text: 'array-updated,second' },
          { scope: ['#variant-probe'], selector: '#variant-handler-count', text: '0' },
        ],
      },
      {
        id: 'function',
        route: PROP_ROUTE,
        action: '同名方法与函数属性分别调用且不互相覆盖',
        nodes: [
          { scope: ['#variant-probe'], selector: '#function-result', text: 'string-updated' },
          { scope: ['#variant-probe'], selector: '#variant-handler-count', text: '1' },
          { selector: '#callback-count', text: '1' },
        ],
      },
      {
        id: 'same-reference',
        route: PROP_ROUTE,
        action: '原地修改嵌套输入并显式提交同引用根值',
        nodes: [
          { scope: ['#variant-probe'], selector: '#object-value', text: 'object-same-reference' },
          { scope: ['#variant-probe'], selector: '#array-value', text: 'array-same-reference,second' },
          { scope: ['#variant-probe'], selector: '#variant-handler-count', text: '1' },
        ],
      },
      {
        id: 'new-wrapper',
        route: PROP_ROUTE,
        action: '提交新外层对象但复用已修改的嵌套输入',
        nodes: [
          { scope: ['#variant-probe'], selector: '#object-value', text: 'object-new-wrapper' },
          { scope: ['#variant-probe'], selector: '#array-value', text: 'array-new-wrapper,second' },
          { scope: ['#variant-probe'], selector: '#variant-handler-count', text: '1' },
        ],
      },
    ])
    const page = await miniProgram!.reLaunch(PROP_ROUTE)
    const probe = await page.$('#default-probe')
    const handler = await probe?.$('#call-back')
    const toggle = await page.$('#toggle-back')
    if (!handler || !toggle) {
      throw new Error('Missing property collision controls')
    }
    await handler.tap()
    await dom.check('called', miniProgram!, page)
    await toggle.tap()
    await dom.check('true', miniProgram!, page)
    await toggle.tap()
    await dom.check('false', miniProgram!, page)
    const update = await page.$('#update-variants')
    const variants = await page.$('#variant-probe')
    const method = await variants?.$('#call-callback')
    const callback = await variants?.$('#call-function-prop')
    if (!update || !method || !callback) {
      throw new Error('Missing typed property controls')
    }
    await update.tap()
    await dom.check('typed-updated', miniProgram!, page)
    await method.tap()
    await callback.tap()
    await dom.check('function', miniProgram!, page)
    const sameReference = await page.$('#commit-same-projection')
    const newWrapper = await page.$('#commit-new-projection')
    if (!sameReference || !newWrapper) {
      throw new Error('Missing projected input commit controls')
    }
    await sameReference.tap()
    await dom.check('same-reference', miniProgram!, page)
    await newWrapper.tap()
    await dom.check('new-wrapper', miniProgram!, page)
  })
})
