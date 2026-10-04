import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { assertIssue1172Artifacts, ROUTES } from './issue1172/artifacts'
import { absentNode, exportedOwnerNodes, isolationNodes, keyedNodes, lifecycleNodes, nativeNodes, nestingNodes, primaryNodes, tapButton, textNode, unprojectedNodes } from './issue1172/dom'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1172'
const layout = resolveRuntimeProviderName() === 'devtools'

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

    it('1172.unprojected', async (context) => {
      const dom = createDomAcceptance(context, FIXTURE, [
        { id: 'closed', route: ROUTES.unprojected, action: '出口不存在时，普通和转发具名消费者已在首次 setup 注入最近宿主并确认身份', nodes: unprojectedNodes(false, { layout }) },
        { id: 'opened', route: ROUTES.unprojected, action: '打开出口后显示此前建立的注入，不重新执行 setup', nodes: unprojectedNodes(true, { layout }) },
        { id: 'updated', route: ROUTES.unprojected, action: '普通和转发消费者分别调用真实 Provider action，保持隔离', nodes: unprojectedNodes(true, { closed: 8, forwarded: 21, layout }) },
        { id: 'closed-again', route: ROUTES.unprojected, action: '关闭出口只移除投影，不重建消费者或修补上下文', nodes: unprojectedNodes(false, { closed: 8, forwarded: 21, layout }) },
        { id: 'reopened', route: ROUTES.unprojected, action: '再次打开仍使用原对象、ref 和 action，setup 次数不变', nodes: unprojectedNodes(true, { closed: 8, forwarded: 21, layout }) },
      ])
      const page = await miniProgram!.reLaunch(ROUTES.unprojected)
      await dom.check('closed', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('opened', miniProgram!, page)
      await tapButton(page, 'increment-closed')
      await tapButton(page, 'increment-forwarded-named')
      await dom.check('updated', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('closed-again', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('reopened', miniProgram!, page)
    })

    it('1172.keyed-unprojected', async (context) => {
      const initial = { 'a-x': 10, 'a-y': 20, 'b-x': 30, 'b-y': 40, 'native-a': 60, 'native-b': 70 }
      const changed = { ...initial, 'a-x': 11 }
      const lateChanged = { ...changed, 'b-y': 41 }
      const { 'a-x': _removed, ...remaining } = lateChanged
      const recreated = { ...lateChanged, 'a-x': 90 }
      const dom = createDomAcceptance(context, FIXTURE, [
        {
          id: 'closed',
          route: ROUTES.keyed,
          action: '同名嵌套循环变量和重复内层 key 不混淆不同外层分支，原生 wx:for 同步注入',
          nodes: [...keyedNodes(false, false, initial, { layout }), textNode('keyed-order', 'a:x,y|b:x,y'), textNode('native-order', '1,2')],
        },
        { id: 'opened', route: ROUTES.keyed, action: '打开后显示六个独立 Provider 和既有消费者', nodes: keyedNodes(true, false, initial, { layout }) },
        { id: 'updated', route: ROUTES.keyed, action: '更新 a-x，后续重排必须保留其原 ref 状态', nodes: keyedNodes(true, false, changed, { layout }) },
        { id: 'closed-again', route: ROUTES.keyed, action: '隐藏出口但保留已挂载实例', nodes: keyedNodes(false, false, changed, { layout }) },
        {
          id: 'moved',
          route: ROUTES.keyed,
          action: '同时反转外层、内层和原生循环，既有消费者不重新 setup',
          nodes: [...keyedNodes(false, false, changed, { layout }), textNode('keyed-order', 'b:y,x|a:y,x'), textNode('native-order', '2,1')],
        },
        { id: 'normalized-keys', route: ROUTES.keyed, action: '原生数字 key 变为等价字符串时不重建 Provider 或消费者', nodes: keyedNodes(false, false, changed, { layout }) },
        { id: 'late', route: ROUTES.keyed, action: '重排后在关闭出口中新增消费者，同步找到本分支原 Provider', nodes: keyedNodes(false, true, changed, { layout }) },
        { id: 'opened-late', route: ROUTES.keyed, action: '新增和原有消费者持有同一个已更新 ref', nodes: keyedNodes(true, true, changed, { layout }) },
        { id: 'late-action', route: ROUTES.keyed, action: '新增 b-y 消费者只更新 b-y Provider 及原消费者', nodes: keyedNodes(true, true, lateChanged, { layout }) },
        {
          id: 'detached',
          route: ROUTES.keyed,
          action: '移除 a-x 分支，不破坏其他循环实例',
          nodes: [...keyedNodes(true, true, remaining, { layout }), absentNode('provider-a-x'), absentNode('count-a-x-main'), absentNode('count-a-x-late')],
        },
        { id: 'recreated', route: ROUTES.keyed, action: '相同声明地址重建时使用新 Provider，不读取旧注册', nodes: keyedNodes(true, true, recreated, { setups: { 'a-x': 2 }, layout }) },
        { id: 'fresh-action', route: ROUTES.keyed, action: '新消费者 action 更新新 ref，其他分支不变', nodes: keyedNodes(true, true, { ...recreated, 'a-x': 91 }, { setups: { 'a-x': 2 }, layout }) },
      ])
      const page = await miniProgram!.reLaunch(ROUTES.keyed)
      await dom.check('closed', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('opened', miniProgram!, page)
      await tapButton(page, 'increment-a-x-main')
      await dom.check('updated', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('closed-again', miniProgram!, page)
      await tapButton(page, 'reverse')
      await dom.check('moved', miniProgram!, page)
      await tapButton(page, 'normalize-keys')
      await dom.check('normalized-keys', miniProgram!, page)
      await tapButton(page, 'add-late')
      await dom.check('late', miniProgram!, page)
      await tapButton(page, 'toggle-outlet')
      await dom.check('opened-late', miniProgram!, page)
      await tapButton(page, 'increment-b-y-late')
      await dom.check('late-action', miniProgram!, page)
      await tapButton(page, 'detach')
      await dom.check('detached', miniProgram!, page)
      await tapButton(page, 'recreate')
      await dom.check('recreated', miniProgram!, page)
      await tapButton(page, 'increment-a-x-late')
      await dom.check('fresh-action', miniProgram!, page)
    })
  }
})
