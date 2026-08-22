export type WevuCompatibilityLevel
  = | 'supported'
    | 'supported-with-differences'
    | 'experimental'
    | 'unsupported'

export type WevuCompatibilityDiagnostic = 'off' | 'warn' | 'error'

export type WevuCompatibilitySurface
  = | 'runtime'
    | 'template'
    | 'sfc-style'
    | 'type'

export type WevuCompatibilityUpstream = 'vue' | 'pinia' | 'vue-router'

export interface WevuCompatibilityEntry {
  upstream: WevuCompatibilityUpstream
  api: string
  wevuEntry: 'wevu' | 'wevu/router' | 'wevu/store' | 'weapp-vite'
  compatibility: WevuCompatibilityLevel
  diagnostic: WevuCompatibilityDiagnostic
  replacement?: string
  summary: string
  docs: string
  surfaces: WevuCompatibilitySurface[]
  platforms?: {
    weapp: 'stable' | 'experimental' | 'unsupported'
    other: 'stable' | 'experimental' | 'unsupported'
  }
}

const entry = (value: WevuCompatibilityEntry) => value

/**
 * Wevu 与 Vue 生态的公开兼容真值。
 *
 * Website、ESLint 规则和兼容审计应消费此清单，避免各自维护状态。
 */
export const wevuCompatibilityCatalog: readonly WevuCompatibilityEntry[] = [
  ...[
    ['vue', 'createSSRApp', 'createApp()'],
    ['vue', 'defineAsyncComponent', '静态组件导入或自动组件注册'],
    ['vue', 'onWatcherCleanup', 'watch() 回调提供的清理函数'],
    ['vue', 'useId', '自行生成稳定的小程序实例 id'],
    ['vue', 'h', 'Wevu JSX/TSX'],
    ['vue', 'createRenderer', 'Wevu 小程序编译运行时'],
    ['vue', 'render', 'Wevu 模板或 JSX/TSX'],
    ['vue-router', 'RouterView', '页面路由与 layout'],
    ['vue-router', 'createWebHistory', 'createRouter()'],
    ['vue-router', 'createWebHashHistory', 'createRouter()'],
  ].map(([upstream, api, replacement]) => entry({
    upstream: upstream as WevuCompatibilityUpstream,
    api,
    wevuEntry: upstream === 'vue-router' ? 'wevu/router' : 'wevu',
    compatibility: 'unsupported',
    diagnostic: 'error',
    replacement,
    summary: '该 Web/renderer 能力不能在 Wevu 小程序运行时使用。',
    docs: '/wevu/compatibility',
    surfaces: ['runtime'],
  })),
  entry({
    upstream: 'vue',
    api: 'hasInjectionContext',
    wevuEntry: 'wevu',
    compatibility: 'supported',
    diagnostic: 'off',
    summary: '与 Wevu 的同步 setup 注入上下文对齐。',
    docs: '/wevu/api/setup-context#hasinjectioncontext',
    surfaces: ['runtime'],
  }),
  entry({
    upstream: 'pinia',
    api: 'createPinia',
    wevuEntry: 'wevu/store',
    compatibility: 'unsupported',
    diagnostic: 'error',
    replacement: 'createStore()；单例场景也可直接 defineStore()',
    summary: 'Wevu Store 不创建 Pinia 根实例。',
    docs: '/wevu/api/store#createpinia',
    surfaces: ['runtime'],
  }),
  entry({
    upstream: 'vue-router',
    api: 'RouterLink',
    wevuEntry: 'wevu/router',
    compatibility: 'unsupported',
    diagnostic: 'error',
    replacement: 'router.push() 或原生 <navigator>',
    summary: '小程序模板没有 Web RouterLink 组件。',
    docs: '/wevu/api/router#routerlink',
    surfaces: ['runtime', 'template'],
  }),
  entry({
    upstream: 'vue-router',
    api: '<router-link>',
    wevuEntry: 'wevu/router',
    compatibility: 'unsupported',
    diagnostic: 'error',
    replacement: 'router.push() 或原生 <navigator>',
    summary: '仅禁止可追溯到 vue-router 的模板组件。',
    docs: '/wevu/api/router#routerlink',
    surfaces: ['template'],
  }),
  ...[
    ['createRouter', '创建时必须处于同步 setup；默认实例按首次创建时序确定。'],
    ['useRouter', '读取 Wevu Router，而非 Web history router。'],
    ['useRoute', '只能在同步 setup 阶段读取。'],
    ['currentRoute', '是 readonly 响应式对象，不是 Ref。'],
    ['isReady', '小程序没有初始异步 history 导航，Promise 立即完成。'],
    ['install', '只建立默认实例，不注册 RouterView 或 RouterLink。'],
    ['push', '映射宿主导航；正向历史、hash、tabBar query 均受宿主限制。'],
    ['replace', '映射宿主 redirect/reLaunch/switchTab，而非 Web history replace。'],
    ['go', '仅支持负数回退；正数历史导航不可用。'],
    ['forward', '小程序没有正向历史栈。'],
  ].map(([api, summary]) => entry({
    upstream: 'vue-router' as const,
    api,
    wevuEntry: 'wevu/router' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'warn' as const,
    summary,
    docs: `/wevu/api/router#router-${api.toLowerCase()}`,
    surfaces: ['runtime'] as WevuCompatibilitySurface[],
  })),
  ...[
    ['defineStore', 'API 形状相近，但没有 Pinia SSR、HMR 和 devtools 生态。'],
    ['storeToRefs', '当前结果包含函数；Pinia 会过滤方法。'],
    ['$reset', 'Options Store 与 Setup Store 均可重置。'],
    ['$subscribe', '订阅批次和错误传播遵循 Wevu 的同步 Store 契约。'],
    ['$onAction', '插件和 action 错误处理不提供完整 Pinia 上下文。'],
    ['install', 'Store manager 的 install() 是 no-op。'],
    ['use', '插件上下文是 Wevu Store manager 契约，不等同 PiniaPluginContext。'],
  ].map(([api, summary]) => entry({
    upstream: 'pinia' as const,
    api,
    wevuEntry: 'wevu/store' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'warn' as const,
    summary,
    docs: `/wevu/api/store#${api.replace(/^\$/, 'store-').toLowerCase()}`,
    surfaces: ['runtime'] as WevuCompatibilitySurface[],
  })),
  ...[
    ['CSS v-bind()', 'CSS 表达式经 compiler-sfc 重写并由 Wevu 响应式桥接到模板根节点。'],
    ['scoped CSS', '使用稳定 scope 属性隔离当前 SFC 拥有的节点。'],
    [':deep()', '支持可映射到小程序选择器的常见 deep 形式。'],
    [':global()', '支持显式移除局部 scope 的常见 global 形式。'],
    [':slotted()', '为 slot 投影节点生成独立 slotted scope 属性。'],
    ['CSS Modules', '支持默认 $style 和命名 module。'],
    ['useCssModule()', '只能在同步 setup 中读取当前 SFC 的 module 映射。'],
  ].map(([api, summary]) => entry({
    upstream: 'vue' as const,
    api,
    wevuEntry: api === 'useCssModule()' ? 'wevu' as const : 'weapp-vite' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'off' as const,
    summary,
    docs: '/wevu/vue-sfc/class-style',
    surfaces: api === 'useCssModule()' ? ['runtime', 'sfc-style'] : ['sfc-style'],
    platforms: {
      weapp: 'stable' as const,
      other: 'experimental' as const,
    },
  })),
  ...[
    ['AppConfig', 'Wevu 配置面向小程序 RuntimeApp，不含 Vue DOM renderer 配置。'],
    ['ComponentPublicInstance', '实例暴露宿主桥接与 Wevu setup 状态，不是 Vue DOM 组件代理。'],
    ['SetupContext', 'attrs、slots、emit、expose 遵循小程序桥接约束。'],
    ['PropType', '用于小程序 properties 推导，运行时构造器能力受宿主限制。'],
    ['VNode', '仅描述 Wevu JSX island 节点，不等同 Vue renderer VNode。'],
    ['ObjectDirective', '只覆盖 Wevu 可编译或可桥接的指令钩子。'],
    ['ExtractPropTypes', '推导结果包含小程序 properties 归一化规则。'],
    ['ExtractPublicPropTypes', '公开 props 推导遵循 Wevu 组件构造类型。'],
  ].map(([api, summary]) => entry({
    upstream: 'vue' as const,
    api,
    wevuEntry: 'wevu' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'warn' as const,
    summary,
    docs: `/wevu/api/types#${api.toLowerCase()}`,
    surfaces: ['type'] as WevuCompatibilitySurface[],
  })),
  ...[
    'ComputedGetter',
    'ComputedRef',
    'ComputedSetter',
    'CustomRefFactory',
    'EffectScope',
    'MaybeRef',
    'MaybeRefOrGetter',
    'Ref',
    'ShallowRef',
    'ToRefs',
    'WritableComputedOptions',
    'WritableComputedRef',
  ].map(api => entry({
    upstream: 'vue' as const,
    api,
    wevuEntry: 'wevu' as const,
    compatibility: 'supported' as const,
    diagnostic: 'off' as const,
    summary: '类型形状与 Vue 响应式类型兼容，由 Wevu 响应式实现承载。',
    docs: `/wevu/api/types#${api.toLowerCase()}`,
    surfaces: ['type'] as WevuCompatibilitySurface[],
  })),
  ...[
    'AllowedComponentProps',
    'ComponentCustomProps',
    'ComponentOptionsMixin',
    'ComponentPropsOptions',
    'ComponentTypeEmits',
    'DefineComponent',
    'EmitFn',
    'EmitsOptions',
    'ExtractDefaultPropTypes',
    'GlobalComponents',
    'GlobalDirectives',
    'ModelRef',
    'PublicProps',
    'ShallowUnwrapRef',
    'TemplateRef',
    'VNodeProps',
  ].map(api => entry({
    upstream: 'vue' as const,
    api,
    wevuEntry: 'wevu' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'warn' as const,
    summary: '同名类型按 Wevu 小程序组件、事件、模板或宿主实例契约收窄。',
    docs: `/wevu/api/types#${api.toLowerCase()}`,
    surfaces: ['type'] as WevuCompatibilitySurface[],
  })),
  ...[
    'MultiWatchSources',
    'WatchCallback',
    'WatchEffect',
    'WatchEffectOptions',
    'WatchOptions',
    'WatchSource',
    'WatchStopHandle',
  ].map(api => entry({
    upstream: 'vue' as const,
    api,
    wevuEntry: 'wevu' as const,
    compatibility: 'supported-with-differences' as const,
    diagnostic: 'warn' as const,
    summary: '类型形状接近 Vue，但 flush 时序和渲染批次遵循 Wevu setData 调度。',
    docs: `/wevu/api/types#${api.toLowerCase()}`,
    surfaces: ['type'] as WevuCompatibilitySurface[],
  })),
] as const

export function findWevuCompatibilityEntry(
  upstream: WevuCompatibilityUpstream,
  api: string,
  surface?: WevuCompatibilitySurface,
) {
  return wevuCompatibilityCatalog.find(item => (
    item.upstream === upstream
    && item.api === api
    && (!surface || item.surfaces.includes(surface))
  ))
}
