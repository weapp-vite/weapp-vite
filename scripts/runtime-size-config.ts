export const RUNTIME_SIZE_REPORT_VERSION = 3 as const

export type RuntimeSizeEntryKind = 'runtime' | 'reactivity' | 'template'

export interface RuntimeSizeTarget {
  id: 'weapp' | 'web'
  label: string
  platform: 'weapp' | 'web'
  entries: Readonly<Record<RuntimeSizeEntryKind, string>>
  gzip: boolean
}

export interface RuntimeSizeTier {
  id: 'reactivity-core' | 'minimal-app' | 'typical-page' | 'complex-component' | 'full-provider'
  label: string
  description: string
  imports?: Partial<Record<RuntimeSizeEntryKind, readonly string[]>>
  targetImports?: Partial<Record<RuntimeSizeTarget['id'], Partial<Record<RuntimeSizeEntryKind, readonly string[]>>>>
}

export interface RuntimeSizeBudget {
  target: RuntimeSizeTarget['id']
  tier: RuntimeSizeTier['id']
  mode: 'production'
  ceilingBytes: number
}

export interface RuntimeSizeDenyRule {
  target: RuntimeSizeTarget['id']
  mode: 'production'
  suffix: string
  allowedTiers: readonly RuntimeSizeTier['id'][]
}

export const runtimeSizeTargets: readonly RuntimeSizeTarget[] = [
  {
    id: 'weapp',
    label: '微信小程序',
    platform: 'weapp',
    entries: {
      runtime: 'wevu/internal-runtime',
      reactivity: 'wevu/internal-reactivity',
      template: 'wevu/internal-template',
    },
    gzip: false,
  },
  {
    id: 'web',
    label: 'Web',
    platform: 'web',
    entries: {
      runtime: '@weapp-vite/web/runtime',
      reactivity: 'wevu/internal-reactivity',
      template: 'wevu/internal-template',
    },
    gzip: true,
  },
] as const

export const runtimeSizeTiers: readonly RuntimeSizeTier[] = [
  {
    id: 'reactivity-core',
    label: '响应式核心',
    description: '`ref`',
    imports: { reactivity: ['ref'] },
  },
  {
    id: 'minimal-app',
    label: '最小应用',
    description: '响应式核心 + `createApp`、`setWevuDefaults`',
    imports: {
      runtime: ['createApp', 'setWevuDefaults'],
      reactivity: ['ref'],
    },
    targetImports: { web: { runtime: ['registerWebWevuApp'] } },
  },
  {
    id: 'typical-page',
    label: '典型页面',
    description: '最小应用 + 组件注册、常用响应式、页面生命周期、class/style 模板辅助',
    imports: {
      runtime: ['createApp', 'setWevuDefaults', 'createWevuComponent', 'onLoad', 'onReady', 'onMounted'],
      reactivity: ['ref', 'reactive', 'computed', 'watch', 'nextTick'],
      template: ['normalizeClass', 'normalizeStyle'],
    },
    targetImports: { web: { runtime: ['registerWebWevuApp', 'registerWebWevuComponent'] } },
  },
  {
    id: 'complex-component',
    label: '复杂组件',
    description: '典型页面 + provide/inject、slots、template ref、model、动态 layout',
    imports: {
      runtime: [
        'createApp',
        'setWevuDefaults',
        'createWevuComponent',
        'onLoad',
        'onReady',
        'onMounted',
        'provide',
        'inject',
        'useSlots',
        'useTemplateRef',
        'useBindModel',
        'setPageLayout',
      ],
      reactivity: ['ref', 'reactive', 'computed', 'watch', 'nextTick'],
      template: ['normalizeClass', 'normalizeStyle'],
    },
    targetImports: { web: { runtime: ['registerWebWevuApp', 'registerWebWevuComponent'] } },
  },
  {
    id: 'full-provider',
    label: '完整 Provider',
    description: '端侧 runtime provider 暴露的全部能力上限',
  },
] as const

export const runtimeSizeBudgets: readonly RuntimeSizeBudget[] = [
  { target: 'weapp', tier: 'minimal-app', mode: 'production', ceilingBytes: 93_535 },
  { target: 'weapp', tier: 'typical-page', mode: 'production', ceilingBytes: 160_182 },
  { target: 'weapp', tier: 'full-provider', mode: 'production', ceilingBytes: 255_783 },
]

export const runtimeSizeDenyRules: readonly RuntimeSizeDenyRule[] = [
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/app/setData/patchScheduler.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/app/setData/payload.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/templateRefs/helpers.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/register/inline.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/register/setDataFrequencyWarning.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/scopedSlots.mjs',
    allowedTiers: ['complex-component', 'full-provider'],
  },
]
