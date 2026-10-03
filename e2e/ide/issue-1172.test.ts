import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { assertIssue1172Artifacts, ROUTES } from './issue1172/artifacts'
import { absentNode, exportedOwnerNodes, isolationNodes, lifecycleNodes, nativeNodes, nestingNodes, primaryNodes, tapButton, textNode } from './issue1172/dom'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1172'

// 两份构建顺序运行；每份只启动一次宿主，并通过 reLaunch 隔离页面状态。
describe.each([
  ['native', true],
  ['augmented', false],
] as const)('issue #1172: %s slot context', { concurrent: false }, (_variant, requireProps) => {
  let project: string | undefined
  let miniProgram: MiniProgram | undefined
  const runtimeErrors: string[] = []

  beforeAll(async () => {
    project = await createIssueRegressionProject(1172)
    if (!requireProps) {
      const configPath = path.join(project, 'vite.config.ts')
      const config = await readFile(configPath, 'utf8')
      await writeFile(configPath, config.replace('scopedSlotsRequireProps: true', 'scopedSlotsRequireProps: false'))
    }
    await buildIssueRegressionProject(project, 'weapp')
    await assertIssue1172Artifacts(project, requireProps)
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTES.primary,
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

  it('1172.primary', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.primary, action: '同步注入普通插槽宿主并由宿主确认对象、ref 和函数身份', nodes: primaryNodes(0) },
      { id: 'incremented', route: ROUTES.primary, action: '点击 Leaf 调用 Provider action，双方渲染同一 ref 的更新', nodes: primaryNodes(1) },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.primary)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'increment-primary')
    await dom.check('incremented', miniProgram!, page)
  })

  it('1172.isolation', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.isolation, action: '两组独立 Provider 各自注入种子和身份', nodes: isolationNodes(0, 10) },
      { id: 'left-only', route: ROUTES.isolation, action: '左侧点击不改变右侧 Provider 和 Leaf', nodes: isolationNodes(1, 10) },
      { id: 'right-only', route: ROUTES.isolation, action: '右侧点击不改变左侧 Provider 和 Leaf', nodes: isolationNodes(1, 11) },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.isolation)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'increment-left')
    await dom.check('left-only', miniProgram!, page)
    await tapButton(page, 'increment-right')
    await dom.check('right-only', miniProgram!, page)
  })

  it('1172.nearest', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.nesting, action: '具名和 view 包裹插槽都选择最近宿主，外层前后消费者保持外层上下文', nodes: nestingNodes(100, 200) },
      { id: 'named', route: ROUTES.nesting, action: '具名 Leaf 更新内层，不改变外层', nodes: nestingNodes(100, 201) },
      { id: 'wrapped', route: ROUTES.nesting, action: '包裹 Leaf 与具名 Leaf 共享内层 ref', nodes: nestingNodes(100, 202) },
      { id: 'outer', route: ROUTES.nesting, action: '内层之后的外层 Leaf 仍更新外层而非残留内层上下文', nodes: nestingNodes(101, 202) },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.nesting)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'increment-inner-named')
    await dom.check('named', miniProgram!, page)
    await tapButton(page, 'increment-inner-wrapped')
    await dom.check('wrapped', miniProgram!, page)
    await tapButton(page, 'increment-outer-after')
    await dom.check('outer', miniProgram!, page)
  })

  it('1172.lifecycle', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.lifecycle, action: '挂载第一组 Provider 和 Leaf', nodes: lifecycleNodes(0) },
      { id: 'before-detach', route: ROUTES.lifecycle, action: '更新旧实例，以便与新实例种子区分', nodes: lifecycleNodes(1) },
      {
        id: 'detached',
        route: ROUTES.lifecycle,
        action: '条件移除 Provider 及投影 Leaf 的实际渲染节点',
        nodes: [textNode('mount-state', 'detached'), absentNode('provider-current'), absentNode('count-current'), absentNode('increment-current')],
      },
      { id: 'recreated', route: ROUTES.lifecycle, action: '新实例同步读取新种子和新上下文，不复用旧 ref 或 action', nodes: lifecycleNodes(40) },
      { id: 'fresh-action', route: ROUTES.lifecycle, action: '重建 Leaf 的点击只更新新 Provider', nodes: lifecycleNodes(41) },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.lifecycle)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'increment-current')
    await dom.check('before-detach', miniProgram!, page)
    await tapButton(page, 'detach')
    await dom.check('detached', miniProgram!, page)
    await tapButton(page, 'recreate')
    await dom.check('recreated', miniProgram!, page)
    await tapButton(page, 'increment-current')
    await dom.check('fresh-action', miniProgram!, page)
  })

  it('1172.native-export', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ROUTES.nativeExport, action: '原生默认及具名投影保持可见，selectOwnerComponent 仅返回 export 公共对象', nodes: nativeNodes(0) },
      { id: 'incremented', route: ROUTES.nativeExport, action: '原生子组件点击通过公开 export action 更新宿主，私有实例仍不暴露', nodes: nativeNodes(1) },
    ])
    const page = await miniProgram!.reLaunch(ROUTES.nativeExport)
    await dom.check('initial', miniProgram!, page)
    await tapButton(page, 'native-increment')
    await dom.check('incremented', miniProgram!, page)
  })

  if (requireProps) {
    it('1172.exported-owner', async (context) => {
      const dom = createDomAcceptance(context, FIXTURE, [
        { id: 'initial', route: ROUTES.exportedOwner, action: '过滤导出的 Wevu Provider 同时承载普通和投影消费者，公开选择器仍不暴露私有实例', nodes: exportedOwnerNodes(200) },
        { id: 'internal-action', route: ROUTES.exportedOwner, action: '普通模板消费者更新内层共享 ref', nodes: exportedOwnerNodes(201) },
        { id: 'aliased-action', route: ROUTES.exportedOwner, action: 'Options API 别名注册的消费者更新同一内层 ref', nodes: exportedOwnerNodes(202) },
        { id: 'projected-action', route: ROUTES.exportedOwner, action: '原生投影消费者更新同一内层 ref，外层不变', nodes: exportedOwnerNodes(203) },
        { id: 'public-action', route: ROUTES.exportedOwner, action: '原生子组件仍可通过过滤后的公开 action 更新内层', nodes: exportedOwnerNodes(204) },
      ])
      const page = await miniProgram!.reLaunch(ROUTES.exportedOwner)
      await dom.check('initial', miniProgram!, page)
      await tapButton(page, 'increment-exported-internal')
      await dom.check('internal-action', miniProgram!, page)
      await tapButton(page, 'increment-exported-aliased')
      await dom.check('aliased-action', miniProgram!, page)
      await tapButton(page, 'increment-exported-projected')
      await dom.check('projected-action', miniProgram!, page)
      await tapButton(page, 'native-increment')
      await dom.check('public-action', miniProgram!, page)
    })
  }
})
