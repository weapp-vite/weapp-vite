export const RUNTIME_SIZE_REPORT_VERSION = 4 as const

export type RuntimeSizePlatform = 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs' | 'web'

export type RuntimeSizeEntryKind = 'runtime' | 'reactivity' | 'template'

export interface RuntimeSizeTarget {
  id: RuntimeSizePlatform
  label: string
  platform: RuntimeSizePlatform
  entries: Readonly<Record<RuntimeSizeEntryKind, string>>
  gzip: boolean
}

export interface RuntimeSizeTier {
  id: 'reactivity-core' | 'minimal-app' | 'typical-page' | 'complex-component' | 'public-app' | 'public-page' | 'full-provider'
  label: string
  description: string
  imports?: Partial<Record<RuntimeSizeEntryKind, readonly string[]>>
  publicEntry?: boolean
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
  ...([
    ['weapp', '微信小程序'],
    ['alipay', '支付宝小程序'],
    ['tt', '抖音小程序'],
    ['swan', '百度小程序'],
    ['jd', '京东小程序'],
    ['xhs', '小红书小程序'],
  ] as const).map(([id, label]) => ({
    id,
    label,
    platform: id,
    entries: {
      runtime: 'wevu/internal-runtime',
      reactivity: 'wevu/internal-reactivity',
      template: 'wevu/internal-template',
    },
    gzip: false,
  })),
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
    id: 'public-app',
    label: '公共入口最小应用',
    description: '从 `wevu` 具名导入最小应用能力，不使用 router 或请求 API；保留动态工厂兼容能力',
    publicEntry: true,
    imports: {
      runtime: ['createApp', 'setWevuDefaults'],
      reactivity: ['ref'],
    },
    targetImports: { web: { runtime: ['registerWebWevuApp'] } },
  },
  {
    id: 'public-page',
    label: '公共入口典型页面',
    description: '从 `wevu` 具名导入典型页面能力，不使用 router 或请求 API；保留动态工厂兼容能力',
    publicEntry: true,
    imports: {
      runtime: ['createApp', 'setWevuDefaults', 'createWevuComponent', 'onLoad', 'onReady', 'onMounted'],
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

const legacyRuntimeSizeBudgets: readonly RuntimeSizeBudget[] = [
  { target: 'weapp', tier: 'minimal-app', mode: 'production', ceilingBytes: 93_535 },
  { target: 'weapp', tier: 'typical-page', mode: 'production', ceilingBytes: 160_182 },
  // main 75aabf000 实测 258,363 B，保留 5% 余量并向上取整。
  { target: 'weapp', tier: 'full-provider', mode: 'production', ceilingBytes: 271_282 },
]

// #1064 重建发布包后的正式 production 实测；新增预算保留 5% 余量。
const runtimeSizeProductionBaselines: Readonly<Record<RuntimeSizePlatform, Readonly<Record<RuntimeSizeTier['id'], number>>>> = {
  weapp: {
    'reactivity-core': 6_560,
    'minimal-app': 75_768,
    'typical-page': 118_848,
    'complex-component': 133_427,
    'public-app': 154_235,
    'public-page': 156_151,
    'full-provider': 252_747,
  },
  alipay: {
    'reactivity-core': 6_560,
    'minimal-app': 75_789,
    'typical-page': 120_878,
    'complex-component': 135_457,
    'public-app': 156_265,
    'public-page': 158_181,
    'full-provider': 254_777,
  },
  tt: {
    'reactivity-core': 6_560,
    'minimal-app': 75_928,
    'typical-page': 119_008,
    'complex-component': 133_587,
    'public-app': 154_395,
    'public-page': 156_311,
    'full-provider': 252_907,
  },
  swan: {
    'reactivity-core': 6_560,
    'minimal-app': 75_774,
    'typical-page': 118_854,
    'complex-component': 133_433,
    'public-app': 154_241,
    'public-page': 156_157,
    'full-provider': 252_753,
  },
  jd: {
    'reactivity-core': 6_560,
    'minimal-app': 75_768,
    'typical-page': 118_848,
    'complex-component': 133_427,
    'public-app': 154_235,
    'public-page': 156_151,
    'full-provider': 252_747,
  },
  xhs: {
    'reactivity-core': 6_560,
    'minimal-app': 75_771,
    'typical-page': 118_851,
    'complex-component': 133_430,
    'public-app': 154_238,
    'public-page': 156_154,
    'full-provider': 252_750,
  },
  web: {
    'reactivity-core': 6_560,
    'minimal-app': 177_495,
    'typical-page': 435_156,
    'complex-component': 445_350,
    'public-app': 256_062,
    'public-page': 472_400,
    'full-provider': 594_473,
  },
}

export const runtimeSizeBudgets: readonly RuntimeSizeBudget[] = [
  ...legacyRuntimeSizeBudgets,
  ...runtimeSizeTargets.flatMap(target => runtimeSizeTiers
    .filter(tier => !legacyRuntimeSizeBudgets.some(budget => budget.target === target.id && budget.tier === tier.id))
    .map(tier => ({
      target: target.id,
      tier: tier.id,
      mode: 'production' as const,
      ceilingBytes: Math.ceil(runtimeSizeProductionBaselines[target.id][tier.id] * 105 / 100),
    }))),
]

export const runtimeSizeDenyRules: readonly RuntimeSizeDenyRule[] = [
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/app/setData/patchScheduler.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/app/setData/payload.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/templateRefs/helpers.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/register/inline.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/register/setDataFrequencyWarning.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
  {
    target: 'weapp',
    mode: 'production',
    suffix: '/runtime/scopedSlots.mjs',
    allowedTiers: ['complex-component', 'public-app', 'public-page', 'full-provider'],
  },
]
