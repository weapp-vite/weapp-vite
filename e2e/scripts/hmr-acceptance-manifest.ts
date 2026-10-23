import path from 'node:path'
import { HMR_RUNTIME_CAPABILITIES } from '../../packages/weapp-vite/src/runtime/hmrRuntimeCapabilities'
import { CAPABILITY_FALLBACK_TASKS } from '../ide/statefulHmrDom/capabilityFallbackCases'
import { HMR_GUARD_ALL_TESTS } from './hmr-guard-manifest'

export interface HmrAcceptanceScenario {
  id: string
  /** 先完成 watch 再启动 runtime 的场景不声明在线更新模式。 */
  expectations: Array<'stateful' | 'classic' | 'classic-fallback'>
  observation?: 'watch-output-and-runtime'
  configuredModes?: Array<'auto' | 'classic' | 'stateful-experimental'>
  capabilityIds: Array<(typeof HMR_RUNTIME_CAPABILITIES)[number]['id']>
  ide: string[]
  headless: string[]
  headlessUnsupportedReason?: string
}

export const HMR_ACCEPTANCE_CAPABILITIES = HMR_RUNTIME_CAPABILITIES

/** 同一场景的增量支持和完整刷新都保留功能断言，不按失败结果删除覆盖。 */
export const HMR_ACCEPTANCE_SCENARIOS: HmrAcceptanceScenario[] = [
  {
    id: 'native-wevu-state-and-template-boundaries',
    expectations: ['stateful'],
    capabilityIds: ['script-patch', 'visual-assets'],
    ide: ['ide/stateful-hmr.runtime.test.ts'],
    headless: ['ide/stateful-hmr.runtime.test.ts'],
  },
  {
    id: 'jsx-and-sibling-script-updates',
    expectations: ['stateful', 'classic-fallback'],
    capabilityIds: ['script-patch', 'native-registration'],
    ide: ['ide/wevu-jsx-tsx.hmr.runtime.test.ts', 'ide/issue-1034-auto-routes-hmr.runtime.test.ts'],
    headless: ['ide/wevu-jsx-tsx.hmr.runtime.test.ts', 'ide/issue-1034-auto-routes-hmr.runtime.test.ts'],
  },
  {
    id: 'automatic-classic-host-reload',
    expectations: ['classic'],
    capabilityIds: ['script-patch'],
    ide: ['ide/hmr-auto-classic.runtime.test.ts'],
    headless: ['ide/hmr-auto-classic.runtime.test.ts'],
  },
  {
    id: 'unsupported-capability-classic-transition',
    expectations: ['classic-fallback'],
    capabilityIds: ['config-json', 'native-registration', 'entry-topology', 'runtime-contract', 'stylesheet-output'],
    ide: CAPABILITY_FALLBACK_TASKS,
    headless: CAPABILITY_FALLBACK_TASKS,
  },
  {
    id: 'unsupported-compiler-startup-classic',
    expectations: ['classic-fallback'],
    capabilityIds: ['compiler-provider'],
    ide: ['ide/hmr-startup-fallback.runtime.test.ts'],
    headless: ['ide/hmr-startup-fallback.runtime.test.ts'],
  },
  {
    id: 'additional-wechat-capability-boundaries',
    expectations: ['classic-fallback'],
    configuredModes: ['stateful-experimental'],
    capabilityIds: ['engine-full-reload', 'patch-shape', 'skyline'],
    ide: ['ide/hmr-additional-capabilities.runtime.test.ts'],
    headless: ['ide/hmr-additional-capabilities.runtime.test.ts'],
  },
  {
    id: 'compiled-template-registration-fallback',
    expectations: ['classic-fallback'],
    configuredModes: ['auto', 'stateful-experimental'],
    capabilityIds: ['native-registration'],
    ide: ['ide/hmr-compiled-template-fallback.runtime.test.ts'],
    headless: ['ide/hmr-compiled-template-fallback.runtime.test.ts'],
  },
  {
    id: 'app-shell-and-external-source',
    expectations: ['stateful', 'classic'],
    capabilityIds: ['script-patch', 'visual-assets', 'entry-topology'],
    ide: ['ide/app-shell-presence.hmr.runtime.test.ts', 'ide/app-vue-hmr-alias.runtime.test.ts', 'ide/script-setup-external-src.runtime.test.ts'],
    headless: ['ide/app-shell-presence.hmr.runtime.test.ts', 'ide/script-setup-external-src.runtime.test.ts'],
  },
  {
    id: 'native-css-and-tailwind',
    expectations: ['classic', 'classic-fallback'],
    capabilityIds: ['script-patch', 'visual-assets', 'stylesheet-output'],
    ide: ['ide/issue-1015-css-hmr.runtime.test.ts', 'ide/issue-998-tailwind.runtime.test.ts', 'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts'],
    headless: ['ide/issue-1015-css-hmr.runtime.test.ts', 'ide/issue-998-tailwind.runtime.test.ts'],
  },
  {
    id: 'tailwind-template-registration-and-local-priority',
    expectations: ['stateful', 'classic-fallback'],
    configuredModes: ['stateful-experimental'],
    capabilityIds: ['script-patch', 'visual-assets', 'stylesheet-output'],
    ide: ['ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts'],
    headless: ['ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts'],
  },
  {
    id: 'compiler-provider-and-tailwind-transactions',
    expectations: ['stateful', 'classic-fallback'],
    capabilityIds: ['script-patch', 'visual-assets', 'compiler-provider', 'config-json', 'stylesheet-output'],
    ide: ['ide/issue-1065-provider.runtime.test.ts', 'ide/issue-1081-tailwind-batch.runtime.test.ts', 'ide/issue-1081-tailwind-snapshot.runtime.test.ts', 'ide/issue-1081-transaction.runtime.test.ts'],
    headless: ['ide/issue-1065-provider.runtime.test.ts', 'ide/issue-1081-tailwind-batch.runtime.test.ts', 'ide/issue-1081-tailwind-snapshot.runtime.test.ts', 'ide/issue-1081-transaction.runtime.test.ts'],
  },
  {
    id: 'native-four-file-batches-and-restoration',
    expectations: ['classic', 'classic-fallback'],
    configuredModes: ['classic', 'stateful-experimental'],
    capabilityIds: ['config-json'],
    ide: ['ide/issue-1134-native-batch.runtime.test.ts'],
    headless: ['ide/issue-1134-native-batch.runtime.test.ts'],
  },
  {
    id: 'native-dependency-and-route-topology',
    expectations: ['classic', 'classic-fallback'],
    configuredModes: ['classic', 'stateful-experimental'],
    capabilityIds: ['config-json', 'entry-topology', 'stylesheet-output'],
    ide: ['ide/issue-1134-native-topology.runtime.test.ts'],
    headless: ['ide/issue-1134-native-topology.runtime.test.ts'],
  },
  {
    id: 'client-replacement-publication-confirmation',
    expectations: ['stateful'],
    configuredModes: ['stateful-experimental'],
    capabilityIds: ['script-patch'],
    ide: ['ide/issue-1082-confirmation.runtime.test.ts'],
    headless: ['ide/issue-1082-confirmation.runtime.test.ts'],
  },
  {
    id: 'forward-console-after-script-update',
    expectations: ['stateful'],
    configuredModes: ['auto'],
    capabilityIds: ['script-patch'],
    ide: ['ide/forward-console-demo.runtime.test.ts'],
    headless: [],
    headlessUnsupportedReason: '场景验证 App.CDPCommand 的 Runtime.disable 后日志订阅恢复；headless 明确不支持该 CDP 协议，不能用普通 console 事件替代。',
  },
  {
    id: 'wxml-watch-dependency-recovery',
    expectations: [],
    observation: 'watch-output-and-runtime',
    configuredModes: ['auto'],
    capabilityIds: ['visual-assets'],
    ide: ['ide/wxml-transform-watch.runtime.test.ts'],
    headless: ['ide/wxml-transform-watch.runtime.test.ts'],
  },
  {
    id: 'automatic-route-watch-topology-recovery',
    expectations: [],
    observation: 'watch-output-and-runtime',
    configuredModes: ['classic'],
    capabilityIds: ['entry-topology'],
    ide: ['ide/auto-routes-define-app-json.runtime.test.ts'],
    headless: ['ide/auto-routes-define-app-json.runtime.test.ts'],
  },
  {
    id: 'wevu-page-layout-and-wxs',
    expectations: ['classic'],
    capabilityIds: ['script-patch', 'visual-assets'],
    ide: ['ide/wevu-runtime.core-hmr.test.ts', 'ide/wevu-runtime.shared-template-wxs.hmr.test.ts', 'ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts', 'ide/wevu-router-hmr.runtime.test.ts'],
    headless: ['ide/wevu-runtime.core-hmr.test.ts', 'ide/wevu-runtime.shared-template-wxs.hmr.test.ts', 'ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts', 'ide/wevu-router-hmr.runtime.test.ts'],
  },
  {
    id: 'shared-host-framework-adapters',
    expectations: ['stateful', 'classic'],
    capabilityIds: ['script-patch', 'visual-assets'],
    ide: ['ide/shared-taro-hmr.runtime.test.ts', 'ide/layout-power-demo.runtime-vendor-hmr.test.ts'],
    headless: [],
  },
  {
    id: 'snapshot-wrapper-ownership',
    expectations: [],
    observation: 'watch-output-and-runtime',
    configuredModes: ['classic'],
    capabilityIds: ['visual-assets'],
    ide: ['ide/automator-bridge-wrapper-hmr.runtime.test.ts'],
    headless: [],
  },
]

const ROOT = path.resolve(import.meta.dirname, '..')

/** 先统一分隔符再去重，避免 Windows 的原生路径与清单 POSIX 路径重复执行。 */
export function uniqueHmrBuildTests(files: readonly string[]) {
  return [...new Set(files.map(file => file.replaceAll('\\', '/')))]
}

export const HMR_ACCEPTANCE_BUILD_TESTS = uniqueHmrBuildTests([
  ...HMR_GUARD_ALL_TESTS,
  ...[
    'ci/stateful-app-shell-hmr.test.ts',
    'ci/stateful-hmr-root-outdir.test.ts',
    'ci/native-sidecar-watch.hmr.test.ts',
    'ci/template-multi-platform-sfc.hmr.test.ts',
    'ci/template-wevu-tdesign-retail-hmr-vendor.test.ts',
    'ci/issue-862-output-watch.test.ts',
    'ci/issue-1065-provider.test.ts',
    'ci/issue-1081-batch-recovery.test.ts',
    'ci/hmr-platform-fallback.test.ts',
  ].map(file => path.resolve(ROOT, file)),
])

export function hmrAcceptanceRuntimeFiles(provider: 'ide' | 'headless') {
  return [...new Set(HMR_ACCEPTANCE_SCENARIOS.flatMap(scenario => scenario[provider]))]
}

export const HMR_ACCEPTANCE_STAGES = [
  { name: 'build', suite: 'hmr-build', provider: 'none' },
  { name: 'headless', suite: 'ide-hmr-headless', provider: 'headless' },
  { name: 'ide', suite: 'ide-hmr', provider: 'devtools' },
] as const

export type HmrAcceptanceStage = typeof HMR_ACCEPTANCE_STAGES[number]
