import { afterAll, describe, expect, it } from 'vitest'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { closeSharedMiniProgram, readClassName, readStyleValue } from './wevu-features.runtime.shared'
import {
  attrsNodes,
  checkpoint,
  injectionScopeNodes,
  modelNodes,
  nativeNodes,
  provideNodes,
  runPageMethod,
  storeNodes,
  styleNodes,
  tapControl,
  textNode,
  withBehaviorPage,
} from './wevuFeaturesDom/behavior'

describe('e2e app: wevu-features / behavior', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders attrs changes and removes the conditional child content', async (context) => {
    await withBehaviorPage(context, 'use-attrs', [
      checkpoint('initial', '首屏渲染父控件和 attrs 子组件', attrsNodes(false)),
      checkpoint('updated', '切换 tone、visible、边框并递增 seed', attrsNodes(true)),
      checkpoint('visible-again', '重新显示 attrs 子节点并检查最新 seed', [
        textNode('#ctrl-toggle-visible', '切换 visible：true'),
        textNode('#attrs-extra', 'extra-label = seed-2', ['#attrs-feature']),
        textNode('#attrs-badge', 'state-class = tone-green', ['#attrs-feature']),
      ]),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ toneChanged: true, visibleChanged: true, borderChanged: true, seedChanged: true })
      expect(result.state.badgeStyle).toContain('solid')
      await check('updated')
      await tapControl(page, '#ctrl-toggle-visible')
      await check('visible-again')
    })
  })

  it('renders slot removal and the updated default slot after reopening', async (context) => {
    await withBehaviorPage(context, 'use-slots', [
      checkpoint('initial', '首屏展开 header 和 default slots', [
        textNode('#slots-panel', 'panel: open', ['#slots-feature']),
        textNode('.use-slots-page__header', 'header slot content'),
        textNode('.use-slots-page__body', 'default slot content 1'),
      ]),
      checkpoint('closed', '关闭 panel、移除 header 并递增 count', [
        textNode('#slots-panel', 'panel: closed', ['#slots-feature']),
        textNode('#slots-ctrl-header', 'header slot: off'),
        textNode('#slots-ctrl-count', 'count: 2'),
        { selector: '.use-slots-page__header', count: 0 },
        { selector: '.use-slots-feature__content', scope: ['#slots-feature'], count: 0 },
      ]),
      checkpoint('reopened', '重新展开仅含更新后 default slot 的 panel', [
        textNode('#slots-panel', 'panel: open', ['#slots-feature']),
        textNode('.use-slots-page__body', 'default slot content 2'),
        { selector: '.use-slots-page__header', count: 0 },
      ]),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ openChanged: true, headerChanged: true, countChanged: true })
      await check('closed')
      await tapControl(page, '#slots-ctrl-open')
      await check('reopened')
    })
  })

  it('renders parent and child model updates in both directions', async (context) => {
    await withBehaviorPage(context, 'use-model', [
      checkpoint('initial', '首屏显示父子 model 和 title', modelNodes('seed-model', 0)),
      checkpoint('parent-update', '父页面设置 alpha model', modelNodes('alpha-from-parent', 1)),
      checkpoint('child-update', '子组件设置 model 并同步父页面', modelNodes('alpha-from-child', 1)),
      checkpoint('child-title', '子组件更新具名 title model', modelNodes('alpha-from-child', 1, 'title-from-child')),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ valueChanged: true, logsChanged: true })
      await check('parent-update')
      await tapControl(page, '#model-inner-alpha', ['#model-feature'])
      await check('child-update')
      await tapControl(page, '#model-title-child', ['#model-feature'])
      await check('child-title')
    })
  })

  it('renders null model input as empty text in both parent and child', async (context) => {
    await withBehaviorPage(context, 'use-model', [
      checkpoint('initial', '首屏 seed model', modelNodes('seed-model', 0)),
      checkpoint('null-cleared', '父页面写入 null 后父子文本同时清空', modelNodes('', 1)),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page, 'runNullGuardE2E')
      expect(result).toMatchObject({ safeValue: '', rawValue: '', hasNullLiteral: false })
      await check('null-cleared')
    })
  })

  it('renders provide/inject state changes from both provider and consumer', async (context) => {
    await withBehaviorPage(context, 'use-provide-inject', [
      checkpoint('initial', '首屏 provider 与 inject 状态一致', provideNodes(1, 'teal', 'init:provider')),
      checkpoint('provider-update', 'provider 递增计数并切换主题', provideNodes(2, 'amber', 'theme:provider')),
      checkpoint('consumer-update', 'inject 组件递增共享计数', provideNodes(3, 'amber', 'inc:inject')),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ countChanged: true, themeChanged: true, actionChanged: true })
      await check('provider-update')
      await tapControl(page, '#inject-inc', ['#inject-feature'])
      await check('consumer-update')
    })
  })

  it('renders app, layout, page, deep component and slot injection scopes', async (context) => {
    await withBehaviorPage(context, 'use-provide-inject-scope', [
      checkpoint('initial', '首屏深层及 slot 组件实际渲染每层注入值', injectionScopeNodes()),
      checkpoint('scope-verified', '执行作用域语义检查后 DOM 值保持一致', injectionScopeNodes()),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ appInstance: true, appSetup: true, pageProvide: true })
      expect(result.state.pageValue).toBe('page-provide-value')
      await check('scope-verified')
    })
  })

  it('renders store mutations, computed values and resets as separate checkpoints', async (context) => {
    await withBehaviorPage(context, 'use-store', [
      checkpoint('initial', '首屏 setup/options stores 初始状态', storeNodes(false)),
      checkpoint('mutated', '执行 action、patch 和 storeToRefs 写入，保留 reset 前状态', storeNodes(true)),
      checkpoint('reset', 'reset 后计数、派生值、标签和集合恢复初始状态', storeNodes(false)),
    ], async (page, check) => {
      await check('initial')
      const mutations = await runPageMethod(page, 'runMutationE2E')
      expect(mutations.checks).toEqual({
        setupCount: true,
        setupLabel: true,
        setupVisits: true,
        setupPatched: true,
        optionsCount: true,
        optionsLabel: true,
        optionsItems: true,
      })
      await check('mutated')
      const reset = await runPageMethod(page, 'runResetE2E')
      expect(reset.checks).toEqual({
        setupResetCount: true,
        setupResetLabel: true,
        setupResetVisits: true,
        optionsResetCount: true,
        optionsResetLabel: true,
        pluginTouched: true,
        subscribeTriggered: true,
        actionTriggered: true,
      })
      expect(reset.details.subscribeEventCount).toBeGreaterThan(0)
      expect(reset.details.actionBeforeCount).toBeGreaterThan(0)
      expect(reset.details.actionAfterCount).toBeGreaterThan(0)
      expect(reset.details.actionErrorCount).toBe(0)
      await check('reset')
    })
  })

  it('renders static and reactive props across the native to Vue component boundary', async (context) => {
    await withBehaviorPage(context, 'native-uses-vue', [
      checkpoint('initial', '首屏静态链路和响应式链路的 Vue 内层文本', nativeNodes(false)),
      checkpoint('updated', '切换 mode 并递增 count 后内层 Vue 文本更新', nativeNodes(true)),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ modeChanged: true, countChanged: true })
      await check('updated')
    })
  })

  it('renders scoped CSS, CSS Modules and reactive CSS variables', async (context) => {
    await withBehaviorPage(context, 'sfc-styles', [
      checkpoint('initial', '首屏 CSS Modules、scoped 节点和红色背景', styleNodes(false)),
      checkpoint('updated', '更新 CSS 变量后保持布局并渲染蓝色背景', styleNodes(true)),
    ], async (page, check) => {
      await check('initial')
      const result = await runPageMethod(page)
      expect(result.checks).toEqual({ cssVarChanged: true, defaultModule: true, namedModule: true })
      await check('updated')
      const className = await readClassName(page, '#sfc-style-probe')
      expect(className).toContain(result.state.defaultClass)
      expect(className).toContain(result.state.namedClass)
      const style = await readStyleValue(page, '#sfc-style-probe')
      expect(style).toMatch(/border: (?:4rpx|2px) solid #111827/)
      expect(style).toContain('#2563eb')
      if (resolveRuntimeProviderName() === 'devtools') {
        const probes = await page.$$('#sfc-style-probe', { fallback: false, timeout: 10_000 })
        expect(probes).toHaveLength(1)
        expect(Number.parseFloat(await probes[0].style('border-top-left-radius'))).toBeGreaterThan(0)
        const size = await probes[0].size()
        expect(size.width / size.height).toBeCloseTo(240 / 96, 1)
      }
    })
  })
})
