import type { HMR_RUNTIME_CAPABILITIES } from '../../../packages/weapp-vite/src/runtime/hmrRuntimeCapabilities'

export interface HmrCapabilityCoverage {
  capabilityId: (typeof HMR_RUNTIME_CAPABILITIES)[number]['id']
  unit: string[]
  build: string[]
  runtimeScenarios: string[]
  runtime: 'planned' | 'pending'
  runtimeApplicability?: {
    target: 'non-wechat'
    reason: string
    requiredBuildTests: string[]
  }
}

const RUNTIME = 'packages/weapp-vite/src/runtime'

/** 这是分层覆盖计划；pending 能力不能靠其他 classic 场景推断为已完成真实回退验收。 */
export const HMR_ACCEPTANCE_CAPABILITY_COVERAGE: HmrCapabilityCoverage[] = [
  {
    capabilityId: 'script-patch',
    unit: [`${RUNTIME}/statefulHmr/session.test.ts`, `${RUNTIME}/statefulHmr/patchModule.test.ts`],
    build: ['e2e/ci/stateful-hmr-root-outdir.test.ts'],
    runtimeScenarios: ['native-wevu-state-and-template-boundaries', 'jsx-and-sibling-script-updates'],
    runtime: 'planned',
  },
  {
    capabilityId: 'visual-assets',
    unit: [`${RUNTIME}/statefulHmr/session.snapshots.test.ts`, 'packages/weapp-vite/src/plugins/core/lifecycle/emit/requestGlobals/incrementalPrelude.test.ts'],
    build: ['e2e/ci/stateful-app-shell-hmr.test.ts', 'e2e/ci/native-sidecar-watch.hmr.test.ts', 'e2e/ci/hmr-request-globals-prelude.test.ts'],
    runtimeScenarios: ['native-css-and-tailwind', 'native-wevu-state-and-template-boundaries'],
    runtime: 'planned',
  },
  {
    capabilityId: 'stylesheet-output',
    unit: ['packages/tailwindcss/src/rootsRpx.test.ts', `${RUNTIME}/hmrRuntimeCapabilities.test.ts`, `${RUNTIME}/statefulHmr/compileBatch.test.ts`, `${RUNTIME}/statefulHmr/outputCapabilities.test.ts`, `${RUNTIME}/statefulHmr/session.snapshots.test.ts`, `${RUNTIME}/classicIdeConfig/owner.test.ts`, `${RUNTIME}/__tests__/watcherService.test.ts`],
    build: ['e2e/ci/hmr-issue-1015-external-css-vars.test.ts', 'e2e/ci/issue-1081-batch-recovery.test.ts'],
    runtimeScenarios: ['unsupported-capability-classic-transition', 'native-css-and-tailwind', 'tailwind-template-registration-and-local-priority', 'compiler-provider-and-tailwind-transactions'],
    runtime: 'planned',
  },
  {
    capabilityId: 'config-json',
    unit: [`${RUNTIME}/hmrRuntimeCapabilities.test.ts`, `${RUNTIME}/hmrRuntimeSession.test.ts`],
    build: [],
    runtimeScenarios: ['unsupported-capability-classic-transition'],
    runtime: 'planned',
  },
  {
    capabilityId: 'entry-topology',
    unit: [`${RUNTIME}/hmrRuntimeCapabilities.test.ts`, `${RUNTIME}/hmrRuntimeSession.test.ts`],
    build: ['e2e/ci/auto-routes-hmr.test.ts'],
    runtimeScenarios: ['unsupported-capability-classic-transition'],
    runtime: 'planned',
  },
  {
    capabilityId: 'engine-full-reload',
    unit: [`${RUNTIME}/hmrRuntimeCapabilities.test.ts`, `${RUNTIME}/statefulHmr/session.snapshots.test.ts`],
    build: [],
    runtimeScenarios: ['additional-wechat-capability-boundaries'],
    runtime: 'planned',
  },
  {
    capabilityId: 'compiler-provider',
    unit: [`${RUNTIME}/hmrRuntimeCapabilities.test.ts`, `${RUNTIME}/hmrRuntimeSession.test.ts`],
    build: ['e2e/ci/issue-1065-provider.test.ts'],
    runtimeScenarios: ['unsupported-compiler-startup-classic'],
    runtime: 'planned',
  },
  {
    capabilityId: 'runtime-contract',
    unit: [`${RUNTIME}/hmrRuntimeSession.test.ts`],
    build: [],
    runtimeScenarios: ['unsupported-capability-classic-transition'],
    runtime: 'planned',
  },
  {
    capabilityId: 'native-registration',
    unit: [`${RUNTIME}/statefulHmr/patchModule.test.ts`, `${RUNTIME}/statefulHmr/viteAdapter.test.ts`, `${RUNTIME}/statefulHmr/templateRegistration.test.ts`, 'packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/templateRegistration.test.ts', 'packages-runtime/wevu-compiler/src/plugins/jsx/templateRegistration.test.ts'],
    build: [],
    runtimeScenarios: ['unsupported-capability-classic-transition', 'compiled-template-registration-fallback', 'jsx-and-sibling-script-updates'],
    runtime: 'planned',
  },
  {
    capabilityId: 'patch-shape',
    unit: [`${RUNTIME}/statefulHmr/patchModule.test.ts`],
    build: ['e2e/ci/stateful-app-shell-hmr.test.ts'],
    runtimeScenarios: ['additional-wechat-capability-boundaries'],
    runtime: 'planned',
  },
  {
    capabilityId: 'platform',
    unit: [`${RUNTIME}/hmrRuntime.test.ts`],
    build: ['e2e/ci/hmr-platform-fallback.test.ts'],
    runtimeScenarios: [],
    runtime: 'pending',
    runtimeApplicability: {
      target: 'non-wechat',
      reason: '本轮真实 runtime 验收仅要求微信 IDE；其他小程序平台通过 CLI/dev 产物回归，未执行其真实 IDE/runtime。',
      requiredBuildTests: ['e2e/ci/hmr-platform-fallback.test.ts'],
    },
  },
  {
    capabilityId: 'skyline',
    unit: [`${RUNTIME}/hmrRuntime.test.ts`],
    build: ['e2e/ci/skyline-hmr-fallback.test.ts'],
    runtimeScenarios: ['additional-wechat-capability-boundaries'],
    runtime: 'planned',
  },
]
