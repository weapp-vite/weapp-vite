import type { SuiteTask } from '../suiteRunner'
import { SELECTED_CASES_ENV } from '../domAcceptanceReport/selectedCases'
import { CLASSIC_BUILD_CASES, CLASSIC_IDE_CASES } from './stableScopeCases'

export const CLASSIC_HMR_SCOPE = 'wechat-startup-classic-v1'
export const CLASSIC_HMR_SCOPE_ENV = 'WEAPP_VITE_E2E_CLASSIC_SCOPE'
export const CLASSIC_HMR_EXCLUDED_CASES_ENV = 'WEAPP_VITE_E2E_CLASSIC_EXCLUDED_CASES'

export const CLASSIC_HMR_OUT_OF_SCOPE_REASONS = {
  stateful: 'Outside wechat-startup-classic-v1: experimental state retention, identity and incremental script transport remain diagnostic contracts.',
  handoff: 'Outside wechat-startup-classic-v1: online stateful-to-classic handoff and publication acknowledgement remain diagnostic contracts.',
  transaction: 'Outside wechat-startup-classic-v1: experimental provider transactions and stateful failure atomicity remain diagnostic contracts.',
  framework: 'Outside wechat-startup-classic-v1: framework state and vendor realm retention across stateful updates remain diagnostic contracts.',
  console: 'Outside wechat-startup-classic-v1: console subscription recovery after stateful delta delivery remains a diagnostic contract.',
} as const

const { stateful, handoff, transaction, framework, console: consoleReason } = CLASSIC_HMR_OUT_OF_SCOPE_REASONS

/** 整个实验文件仍进入冻结清单，以明确范围外记录保留原失败与诊断入口。 */
export const CLASSIC_HMR_OUT_OF_SCOPE_TASKS: Record<string, string> = {
  'ide/stateful-hmr.runtime.test.ts': stateful,
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts': stateful,
  'ide/issue-1034-auto-routes-hmr.runtime.test.ts': stateful,
  'ide/hmr-capability-fallback.runtime.test.ts': handoff,
  'ide/hmr-capability-fallback.wv.runtime.test.ts': handoff,
  'ide/hmr-capability-fallback.vite.runtime.test.ts': handoff,
  'ide/hmr-capability-fallback.vite-plus.runtime.test.ts': handoff,
  'ide/hmr-compiled-template-fallback.runtime.test.ts': handoff,
  'ide/app-vue-hmr-alias.runtime.test.ts': stateful,
  'ide/issue-998-tailwind.runtime.test.ts': handoff,
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts': framework,
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts': handoff,
  'ide/issue-1065-provider.runtime.test.ts': transaction,
  'ide/issue-1081-tailwind-batch.runtime.test.ts': transaction,
  'ide/issue-1081-tailwind-snapshot.runtime.test.ts': transaction,
  'ide/issue-1081-transaction.runtime.test.ts': transaction,
  'ide/issue-1082-confirmation.runtime.test.ts': handoff,
  'ide/forward-console-demo.runtime.test.ts': consoleReason,
  'ide/shared-taro-hmr.runtime.test.ts': framework,
  'ide/layout-power-demo.runtime-vendor-hmr.test.ts': framework,
  'ci/stateful-app-shell-hmr.test.ts': stateful,
  'ci/stateful-hmr-root-outdir.test.ts': stateful,
  'ci/issue-1081-batch-recovery.test.ts': transaction,
}

const stableSuites = new Set([
  'hmr-build:classic',
  'ide-hmr:classic',
  'ide-hmr-headless:classic',
  'ide-full:classic',
  'ide-full:exhaustive:classic',
  'ide-dom-headless:classic',
  'ide-headless-full:classic',
  'ci:classic',
  'ci-full:classic',
  'ci-non-hmr:classic',
  'ci-pr:classic',
])
const stableReasons = new Set<string>(Object.values(CLASSIC_HMR_OUT_OF_SCOPE_REASONS))

export function isStableHmrSuite(suite: string) {
  return stableSuites.has(suite.replace(/^e2e:/, '').split(/\s+/)[0] ?? '')
}

export function isStableHmrOutOfScopeReason(reason: string) {
  return stableReasons.has(reason)
}

function escapeCaseName(name: string) {
  return name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 非 HMR 任务原样复用，混合文件只筛选已冻结的原 classic 用例。 */
export function applyClassicSupportScope(task: SuiteTask): SuiteTask {
  if (task.outOfScopeReason) {
    return task
  }
  const reason = CLASSIC_HMR_OUT_OF_SCOPE_TASKS[task.label]
  if (reason) {
    return { ...task, outOfScopeReason: reason, env: { ...task.env, [CLASSIC_HMR_SCOPE_ENV]: CLASSIC_HMR_SCOPE } }
  }
  const cases = CLASSIC_IDE_CASES[task.label] ?? CLASSIC_BUILD_CASES[task.label]
  if (!cases) {
    return task
  }
  const selected = cases.filter(item => item.supported).map(({ name }) => ({ file: `e2e/${task.label}`, name }))
  const excluded = cases.filter(item => !item.supported).map(({ name }) => ({ file: `e2e/${task.label}`, name, reason: handoff }))
  return {
    ...task,
    args: [...task.args, '--testNamePattern', `^(?:${selected.map(item => escapeCaseName(item.name)).join('|')})$`],
    env: {
      ...task.env,
      [CLASSIC_HMR_SCOPE_ENV]: CLASSIC_HMR_SCOPE,
      [CLASSIC_HMR_EXCLUDED_CASES_ENV]: JSON.stringify(excluded),
      ...(CLASSIC_IDE_CASES[task.label] ? { [SELECTED_CASES_ENV]: JSON.stringify(selected) } : {}),
    },
  }
}
