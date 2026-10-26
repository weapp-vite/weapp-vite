/* eslint-disable e18e/ban-dependencies -- e2e 套件清单需要 fast-glob 收集测试文件。 */
import type { SuiteTask } from './suiteRunner'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
// 只读取环境变量常量；直接依赖 ownership 入口会在冻结普通 CI 计划时加载
// @weapp-vite/devtools-runtime，而该包由 build job 产出，计划 job 不应依赖它。
import { MANAGED_PROJECT_MAX_WINDOWS_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/constants'
import { resolveVerificationTopology, TDESIGN_AGGREGATE_LABEL, TDESIGN_SOURCE_LABELS, topologyEnvironment } from '../../scripts/verification/topology.ts'
import { TEMPLATE_DEV_OPEN_CASES } from '../ide/template-dev-open-cases'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import { HMR_ACCEPTANCE_BUILD_TESTS, hmrAcceptanceRuntimeFiles } from './hmr-acceptance-manifest'
import { HMR_GUARD_ALL_TESTS, HMR_GUARD_SPECIAL_CASES, HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION, HMR_GUARD_UTILITY_TESTS } from './hmr-guard-manifest'
import { applyClassicSupportScope } from './hmrAcceptance/stableScope'

const ROOT = path.resolve(import.meta.dirname, '..')
const CI_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.ci.config.ts')
const DEVTOOLS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.devtools.config.ts')
const HEADLESS_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.headless.config.ts')
const WEB_CONFIG_PATH = path.resolve(ROOT, 'vitest.e2e.web.config.ts')
const AUTOMATOR_BRIDGE_WRAPPER_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER'
const TASK_TIMEOUT_ENV = 'WEAPP_VITE_E2E_TASK_TIMEOUT_MS'
const TEMPLATE_DEV_OPEN_RUNNER_LABELS = new Set([
  'ide/template-dev-open-all.runtime.test.ts',
  'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
])
const IDE_TWO_WINDOW_TEST_LABELS = new Set([
  // 同时保留两个项目，验证 automator 会话和端口互不串用。
  'ide/automator-concurrent-sessions.runtime.test.ts',
  // 保留另一项目，验证共享宿主内的断开、关闭和重连隔离。
  'ide/devtools-shared-host.runtime.test.ts',
])
export const IDE_GITHUB_ISSUES_AGGREGATE_LABEL = 'ide/github-issues.runtime.aggregate.test.ts'
export const IDE_TDESIGN_AGGREGATE_LABEL = TDESIGN_AGGREGATE_LABEL
export const IDE_TDESIGN_AGGREGATED_PATTERNS = TDESIGN_SOURCE_LABELS
export const IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS = new Set([
  'ide/swan-runtime.optional.test.ts',
  'ide/template-multi-platform.swan.optional.test.ts',
  'ide/template-multi-platform-sfc.swan.optional.test.ts',
])
export const IDE_GITHUB_ISSUES_AGGREGATE_LABELS = [
  IDE_GITHUB_ISSUES_AGGREGATE_LABEL,
] as const
const IDE_TASK_TIMEOUT_MS_BY_LABEL = new Map([
  ['ide/issue-1015-css-hmr.runtime.test.ts', '900000'],
  // 两个模式各保留 300 秒运行与 300 秒清理预算，额外预留 worker 启停。
  ['ide/issue-1140-mode-cache.runtime.test.ts', '1260000'],
  ['ide/devtools-cli-workflow.runtime.test.ts', '900000'],
  ['ide/github-issues.runtime.aggregate.test.ts', '3600000'],
  [IDE_TDESIGN_AGGREGATE_LABEL, '900000'],
  ['ide/github-issues.runtime.lifecycle.test.ts', '600000'],
  ['ide/github-issues.runtime.props.test.ts', '600000'],
  // 兼容旧入口的原有预算；正式按宿主分别执行，不增加 case、hook 或断言等待。
  ['ide/hmr-capability-fallback.runtime.test.ts', '1800000'],
  // Stable 实测 wv/vite 七例约 647/676 秒；wv 额外一例样式回退约 154 秒，保留 worker 收尾余量。
  ['ide/hmr-capability-fallback.wv.runtime.test.ts', '900000'],
  ['ide/hmr-capability-fallback.vite.runtime.test.ts', '900000'],
  ['ide/hmr-capability-fallback.vite-plus.runtime.test.ts', '900000'],
  ['ide/hmr-startup-fallback.runtime.test.ts', '900000'],
  ['ide/hmr-additional-capabilities.runtime.test.ts', '600000'],
  ['ide/hmr-compiled-template-fallback.runtime.test.ts', '600000'],
  ['ide/stateful-hmr.runtime.test.ts', '900000'],
  ['ide/subpackage-shared-strategy-complex.runtime.test.ts', '600000'],
  ['ide/template-dev-open-all.runtime.test.ts', '1800000'],
  // P/W 各自串行验证首屏与完整资源收尾，不增加全局任务预算。
  ['ide/template-plugin-dev-open.runtime.test.ts', '1260000'],
  ['ide/template-tailwindcss-dev-open-multi.runtime.test.ts', '1200000'],
  ['ide/template-tailwindcss-tdesign-hmr.runtime.test.ts', '900000'],
  ['ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts', '900000'],
  ['ide/uview-plus-compat.runtime.test.ts', '1200000'],
  ['ide/wevu-runtime.core-hmr.test.ts', '900000'],
  ['ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts', '900000'],
  ['ide/wevu-runtime.weapp.test.ts', '600000'],
  ['ide/wevu-jsx-tsx.hmr.runtime.test.ts', '900000'],
  ['ide/wevu-jsx-tsx.runtime.test.ts', '600000'],
  ['ide/wot-ui-compat.runtime.test.ts', '1200000'],
])
const IDE_BRIDGE_WRAPPER_TEST_LABELS = new Set([
  'ide/app-shell-presence.hmr.runtime.test.ts',
  'ide/app-vue-hmr-alias.runtime.test.ts',
  'ide/automator-bridge-wrapper-hmr.runtime.test.ts',
  'ide/automator-concurrent-sessions.runtime.test.ts',
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/github-issues.runtime.issue1015.test.ts',
  'ide/github-issues.runtime.issue547.test.ts',
  ...IDE_GITHUB_ISSUES_AGGREGATE_LABELS,
  'ide/github-issues.runtime.require-async.test.ts',
  'ide/github-issues.runtime.issue911.test.ts',
  'ide/github-issues.runtime.issue941.test.ts',
  'ide/github-issues.runtime.issue1138.test.ts',
  'ide/github-issues.runtime.issue1011.test.ts',
  'ide/lifecycle-compare.test.ts',
  'ide/github-issues.runtime.feature1087.test.ts',
  'ide/react-runtime-spike.runtime.test.ts',
  'ide/shared-styles.runtime.test.ts',
  'ide/stateful-hmr.runtime.test.ts',
  'ide/subpackage-shared-strategy-complex.runtime.test.ts',
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
  'ide/wevu-runtime.core-hmr.test.ts',
  'ide/wevu-runtime.layout-shared-template-wxs.hmr.test.ts',
])
export const IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS = [
  'ide/github-issues.runtime.issue1008.test.ts',
  'ide/github-issues.runtime.app-shell.test.ts',
  'ide/github-issues.runtime.import-meta.test.ts',
  'ide/github-issues.runtime.issue289.test.ts',
  'ide/github-issues.runtime.issue297-302.test.ts',
  'ide/github-issues.runtime.issue466.test.ts',
  'ide/github-issues.runtime.issue553-555.test.ts',
  'ide/github-issues.runtime.issue554.test.ts',
  'ide/github-issues.runtime.issue564.test.ts',
  'ide/github-issues.runtime.issue581.test.ts',
  'ide/github-issues.runtime.issue627.test.ts',
  'ide/github-issues.runtime.issue642.test.ts',
  'ide/github-issues.runtime.issue705.test.ts',
  'ide/github-issues.runtime.issue706.test.ts',
  'ide/github-issues.runtime.issue829.test.ts',
  'ide/github-issues.runtime.issue930.test.ts',
  'ide/github-issues.runtime.issue1013.test.ts',
  'ide/github-issues.runtime.issue1014.test.ts',
  'ide/github-issues.runtime.lifecycle.test.ts',
  'ide/github-issues.runtime.miniprogram-computed.test.ts',
  'ide/github-issues.runtime.props.test.ts',
  'ide/github-issues.runtime.slot-fallback.test.ts',
  'ide/github-issues.runtime.web-runtime.test.ts',
] as const
const IDE_GITHUB_ISSUES_AGGREGATED_PATTERN_SET = new Set<string>(IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS)
const IDE_GITHUB_ISSUES_PATTERNS = [
  'ide/issue-1234-automator.runtime.test.ts',
  'ide/wxml-transform.runtime.test.ts',
  'ide/wxml-transform-watch.runtime.test.ts',
  'ide/wevu-runtime.pruning.test.ts',
  'ide/github-issues.runtime.issue1035.test.ts',
  'ide/issue-963-plugin-es6.runtime.test.ts',
  'ide/issue-997-rebuild.runtime.test.ts',
  'ide/issue-998-tailwind.runtime.test.ts',
  'ide/issue-1081-tailwind-batch.runtime.test.ts',
  'ide/issue-1081-tailwind-snapshot.runtime.test.ts',
  'ide/issue-1058-template-tags.runtime.test.ts',
  'ide/issue-1065-provider.runtime.test.ts',
  'ide/issue-1081-transaction.runtime.test.ts',
  'ide/issue-1082-confirmation.runtime.test.ts',
  'ide/issue-1134-native-batch.runtime.test.ts',
  'ide/issue-1134-native-topology.runtime.test.ts',
  'ide/issue-1140-mode-cache.runtime.test.ts',
  'ide/issue-1074-doctor.runtime.test.ts',
  'ide/wevu-initial-style.runtime.test.ts',
  'ide/issue-1015-css-hmr.runtime.test.ts',
  'ide/issue-1126-1128.test.ts',
  'ide/issue-1172.test.ts',
  'ide/issue-1174.native-slot-opt-in.test.ts',
  'ide/issue-1182-production-mount.runtime.test.ts',
  'ide/issue-1185-sibling-entry.runtime.test.ts',
  'ide/issue-1235-component-reentry.runtime.test.ts',
  'ide/issue-1249-dataset.runtime.test.ts',
  'ide/issue-1029-auto-routes.runtime.test.ts',
  'ide/issue-1034-auto-routes.runtime.test.ts',
  'ide/issue-1034-auto-routes-hmr.runtime.test.ts',
  'ide/issue-1072-json-context.runtime.test.ts',
  'ide/github-issues.runtime.component-instance-apis.test.ts',
  'ide/github-issues.runtime.issue1015.test.ts',
  ...IDE_GITHUB_ISSUES_AGGREGATE_LABELS,
  // wx.downloadFile 的域名校验依赖完整独立项目，不能复用聚合目标的裁剪构建。
  'ide/github-issues.runtime.issue448-formdata-upload.test.ts',
  'ide/github-issues.runtime.issue547.test.ts',
  'ide/github-issues.runtime.issue558.test.ts',
  'ide/github-issues.runtime.issue615.test.ts',
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/github-issues.runtime.issue1010.test.ts',
  // 预处理器使用独立构建配置，不能合入默认 github-issues 聚合会话。
  'ide/github-issues.runtime.issue779.test.ts',
  'ide/github-issues.runtime.issue826.test.ts',
  'ide/github-issues.runtime.issue642-bug7-default.test.ts',
  'ide/github-issues.runtime.issue642-bug7-performance.test.ts',
  'ide/github-issues.runtime.issue642-bug8.test.ts',
  'ide/github-issues.runtime.require-async.test.ts',
  'ide/github-issues.runtime.issue911.test.ts',
  'ide/github-issues.runtime.issue941.test.ts',
  'ide/github-issues.runtime.issue1138.test.ts',
  'ide/github-issues.runtime.issue1009.test.ts',
  'ide/github-issues.runtime.issue1049.test.ts',
  'ide/github-issues.runtime.feature1087.test.ts',
  'ide/github-issues.runtime.issue1011.test.ts',
  'ide/github-issues.runtime.issue1012.test.ts',
  'ide/github-issues.runtime.issue852.test.ts',
  'ide/github-issues.runtime.slot-fallback-compiler-off.test.ts',
  'ide/github-issues.runtime.subpackage-item.test.ts',
  'ide/github-issues.runtime.subpackage-user.test.ts',
]
const IDE_CHUNK_MODES_PATTERNS = [
  'ide/chunk-modes.runtime.duplicate.test.ts',
  'ide/chunk-modes.runtime.extras.test.ts',
  'ide/chunk-modes.runtime.hoist.test.ts',
]
const IDE_WEVU_FEATURES_PATTERNS = [
  'ide/template-wevu-features-app.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
  'ide/wevu-features.runtime.router.test.ts',
  'ide/wevu-features.runtime.subpath.test.ts',
  'ide/wevu-query.runtime.test.ts',
  'ide/wevu-router-hmr.runtime.test.ts',
]
const IDE_TEMPLATES_PATTERNS = [
  'ide/template-retail-checkout.runtime.test.ts',
  'ide/devtools-cli-workflow.runtime.test.ts',
  'ide/mcp-runtime-tools.runtime.test.ts',
  'ide/template-dev-open-all.runtime.test.ts',
  'ide/template-plugin-dev-open.runtime.test.ts',
  'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
  'ide/template-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/template-weapp-vite-tailwindcss-tdesign-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-template.test.ts',
  'ide/template-weapp-vite-tailwindcss-vant-template.test.ts',
  'ide/template-weapp-vite-multi-platform-template.test.ts',
  'ide/template-weapp-vite-multi-platform-sfc-template.test.ts',
  'ide/template-weapp-vite-template.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.feedback-runtime.test.ts',
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts',
  IDE_TDESIGN_AGGREGATE_LABEL,
  'ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.test.ts',
  'ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts',
  'ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts',
  'ide/template-weapp-vite-wevu-template.test.ts',
  'ide/template-wevu-features-app.test.ts',
]
const IDE_FULL_CORE_PATTERNS = [
  'ide/native-property-delivery.runtime.test.ts',
  'ide/app-shell-presence.hmr.runtime.test.ts',
  'ide/vite-plugin.runtime.test.ts',
  'ide/vite-plugin-npm.runtime.test.ts',
  'ide/app-lifecycle.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/devtools-cli-workflow.runtime.test.ts',
  ...IDE_GITHUB_ISSUES_AGGREGATE_LABELS,
  'ide/github-issues.runtime.issue621.test.ts',
  'ide/github-issues.runtime.issue1010.test.ts',
  'ide/github-issues.runtime.issue779.test.ts',
  'ide/github-issues.runtime.issue852.test.ts',
  'ide/github-issues.runtime.subpackage-item.test.ts',
  'ide/github-issues.runtime.subpackage-user.test.ts',
  'ide/lifecycle-compare.test.ts',
  'ide/react-runtime-spike.runtime.test.ts',
  'ide/shared-styles.runtime.test.ts',
  'ide/stateful-hmr.runtime.test.ts',
  'ide/subpackage-shared-strategy-complex.runtime.test.ts',
  'ide/template-dev-open-all.runtime.test.ts',
  'ide/template-plugin-dev-open.runtime.test.ts',
  'ide/template-tailwindcss-dev-open-multi.runtime.test.ts',
  'ide/template-wevu-tailwindcss-tdesign-hmr.runtime.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
  'ide/wevu-query.runtime.test.ts',
  'ide/wevu-runtime.weapp.test.ts',
]
const IDE_WEVU_JSX_PATTERNS = [
  'ide/wevu-jsx-tsx.runtime.test.ts',
  'ide/wevu-jsx-tsx.hmr.runtime.test.ts',
]
const IDE_COMPONENT_LIBRARY_PATTERNS = [
  'ide/uview-plus-compat.runtime.test.ts',
  'ide/wot-ui-compat.runtime.test.ts',
]
const IDE_COMPONENT_LIBRARY_PATTERN_SET = new Set(IDE_COMPONENT_LIBRARY_PATTERNS)
const IDE_HELPER_TEST_PATTERNS = new Set([
  'ide/runtimeErrors.test.ts',
  // 旧入口保留手动兼容；正式清单通过三个宿主入口覆盖同一矩阵。
  'ide/hmr-capability-fallback.runtime.test.ts',
])
const IDE_MANUAL_DEVTOOLS_TEST_PATTERNS = new Set([
  // tdesign 官方 retail 示例在当前 DevTools 自动化上下文中会返回空白截图和空 app-service 页面栈。
  'ide/tdesign-miniprogram-starter-retail.runtime.test.ts',
])
const IDE_SMOKE_TESTS = [
  'ide/index.test.ts',
  'ide/app-lifecycle.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/template-weapp-vite-template.test.ts',
  'ide/template-weapp-vite-wevu-template.test.ts',
  'ide/wevu-runtime.weapp.test.ts',
].map(testPath => path.resolve(ROOT, testPath))
const IDE_GATE_TESTS = [
  ...IDE_SMOKE_TESTS,
  'ide/lifecycle-compare.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
].map(testPath => path.resolve(ROOT, testPath))
// #779 的计算样式由真实 IDE 与 simulator 的 pageStyleImports browser companion 验收；逻辑树不提供颜色证据。
const IDE_DOM_HEADLESS_PATTERNS = [...new Set([
  'ide/native-property-delivery.runtime.test.ts',
  'ide/template-plugin-dev-open.runtime.test.ts',
  'ide/issue-1234-automator.runtime.test.ts',
  'ide/app-shell-presence.hmr.runtime.test.ts',
  'ide/script-setup-external-src.runtime.test.ts',
  'ide/issue-1058-template-tags.runtime.test.ts',
  'ide/issue-1065-provider.runtime.test.ts',
  'ide/github-issues.runtime.issue1138.test.ts',
  'ide/vite-plugin.runtime.test.ts',
  'ide/vite-plugin-npm.runtime.test.ts',
  'ide/wevu-runtime.pruning.test.ts',
  'ide/github-issues.runtime.issue1035.test.ts',
  'ide/github-issues.runtime.feature1087.test.ts',
  'ide/issue-963-plugin-es6.runtime.test.ts',
  'ide/issue-997-rebuild.runtime.test.ts',
  'ide/issue-998-tailwind.runtime.test.ts',
  'ide/issue-1081-tailwind-batch.runtime.test.ts',
  'ide/issue-1081-tailwind-snapshot.runtime.test.ts',
  'ide/issue-1081-transaction.runtime.test.ts',
  'ide/issue-1082-confirmation.runtime.test.ts',
  'ide/issue-1134-native-batch.runtime.test.ts',
  'ide/issue-1134-native-topology.runtime.test.ts',
  'ide/issue-1140-mode-cache.runtime.test.ts',
  'ide/issue-1074-doctor.runtime.test.ts',
  'ide/wevu-initial-style.runtime.test.ts',
  'ide/body-blob.runtime.test.ts',
  'ide/stream-capability.runtime.test.ts',
  'ide/app-lifecycle.test.ts',
  'ide/github-issues.runtime.component-instance-apis.test.ts',
  'ide/github-issues.runtime.issue1010.test.ts',
  'ide/github-issues.runtime.issue1011.test.ts',
  'ide/github-issues.runtime.issue1012.test.ts',
  'ide/github-issues.runtime.issue1015.test.ts',
  'ide/issue-1126-1128.test.ts',
  'ide/issue-1172.test.ts',
  'ide/issue-1174.native-slot-opt-in.test.ts',
  'ide/issue-1182-production-mount.runtime.test.ts',
  'ide/issue-1185-sibling-entry.runtime.test.ts',
  'ide/issue-1235-component-reentry.runtime.test.ts',
  'ide/issue-1249-dataset.runtime.test.ts',
  'ide/issue-1029-auto-routes.runtime.test.ts',
  'ide/issue-1034-auto-routes.runtime.test.ts',
  'ide/issue-1034-auto-routes-hmr.runtime.test.ts',
  'ide/issue-1072-json-context.runtime.test.ts',
  'ide/template-retail-checkout.runtime.test.ts',
  'ide/app-prelude-native.runtime.test.ts',
  'ide/wxml-transform.runtime.test.ts',
  'ide/wxml-transform-watch.runtime.test.ts',
  'ide/auto-routes-define-app-json.runtime.test.ts',
  'ide/react-runtime-spike.runtime.test.ts',
  'ide/wevu-features.runtime.behavior.test.ts',
  'ide/wevu-features.runtime.router.test.ts',
  'ide/template-weapp-vite-template.test.ts',
  'ide/template-weapp-vite-wevu-template.test.ts',
  'ide/template-weapp-vite-multi-platform-template.test.ts',
  'ide/template-weapp-vite-multi-platform-sfc-template.test.ts',
  'ide/template-weapp-vite-wevu-template.layouts.runtime.test.ts',
  'ide/chunk-modes.runtime.duplicate.test.ts',
  'ide/template-weapp-vite-wevu-template.dynamic-bindings.test.ts',
  'ide/chunk-modes.runtime.hoist.test.ts',
  'ide/chunk-modes.runtime.extras.test.ts',
  'ide/subpackage-shared-strategy-complex.runtime.test.ts',
  'ide/tdesign-dialog-import.runtime.test.ts',
  'ide/wevu-vue-demo.script-setup.emit.runtime.test.ts',
  'ide/wevu-comprehensive.runtime.test.ts',
  'ide/wevu-json-render.runtime.test.ts',
  'ide/wevu-subpackage-placement.runtime.test.ts',
  'ide/worker-host.runtime.test.ts',
  'ide/lib-host.runtime.test.ts',
  'ide/platform-host.runtime.test.ts',
  ...hmrAcceptanceRuntimeFiles('headless'),
])]
const IDE_HEADLESS_FULL_TESTS = [...new Set([
  ...IDE_GATE_TESTS,
  ...IDE_DOM_HEADLESS_PATTERNS.map(filePath => path.resolve(ROOT, filePath)),
  path.resolve(ROOT, 'ide/github-issues.runtime.issue705.test.ts'),
  path.resolve(ROOT, 'ide/github-issues.runtime.issue826.test.ts'),
  path.resolve(ROOT, 'ide/github-issues.runtime.require-async.test.ts'),
  path.resolve(ROOT, 'ide/github-issues.runtime.issue1009.test.ts'),
  path.resolve(ROOT, 'ide/github-issues.runtime.issue1049.test.ts'),
  path.resolve(ROOT, 'ide/shared-styles.runtime.test.ts'),
  path.resolve(ROOT, 'ide/wevu-jsx-tsx.runtime.test.ts'),
  path.resolve(ROOT, 'ide/wevu-query.runtime.test.ts'),
])]

// PR 只验证最能代表构建、运行时、路由和平台契约的短路径；完整清单由 nightly 执行。
const CI_PR_PATTERNS = [
  'ci/wevu-runtime.pruning.test.ts',
  'ci/app-prelude-native.build.test.ts',
  'ci/auto-routes-define-app-json.test.ts',
  'ci/benchmark-hmr-entrypoint.test.ts',
  'ci/config-merge.e2e.test.ts',
  'ci/github-issues-runtime-shared.test.ts',
  'ci/github-issues.build.test.ts',
  'ci/github-issues.issue1035.build.test.ts',
  'ci/issue-862-output-watch.test.ts',
  'ci/issue-1029-auto-routes.test.ts',
  'ci/issue-1034-auto-routes.test.ts',
  'ci/issue-1185-sibling-entry.test.ts',
  'ci/issue-1072-json-context.test.ts',
  'ci/headless-automator-provider.test.ts',
  'ci/platform-build.test.ts',
  'ci/platform-matrix.test.ts',
  'ci/request-clients-real.request-runtime.build.test.ts',
  'ci/runtime-provider.test.ts',
  'ci/shared-styles.build.test.ts',
  'ci/template-e2e.utils.test.ts',
  'ci/template-multi-platform-sfc.hmr.test.ts',
  'ci/wevu-features.build.test.ts',
  'ci/wevu-jsx-tsx.build.test.ts',
  'ci/wevu-runtime.npm-platforms.test.ts',
  'ci/wevu-runtime.platform-dependency-modes.test.ts',
  'ci/wevu-runtime.platforms.test.ts',
  'ci/wevu-runtime.utils.test.ts',
  'ci/wevu-subpackage-placement.build.test.ts',
] as const
export const SKIP_CI_HMR_GUARD_ENV = 'WEAPP_VITE_E2E_CI_SKIP_HMR_GUARD'

export interface SuiteTaskFactoryOptions {
  topology?: string
  skipDiskBackedDevProbe?: boolean
}

type SuiteFactory = (options?: SuiteTaskFactoryOptions) => SuiteTask[] | Promise<SuiteTask[]>

export interface E2ESuiteDefinition {
  description: string
  name: string
  tasks: SuiteFactory
}

export interface E2ETaskShardOptions {
  index: number
  total: number
}

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

function toRelativeLabel(filePath: string) {
  return toPosixPath(path.relative(ROOT, filePath))
}

function resolveTaskWeight(label: string) {
  const configured = process.env.WEAPP_VITE_E2E_TASK_DURATIONS
  if (configured) {
    try {
      const durations = JSON.parse(configured) as Record<string, unknown>
      const duration = durations[label]
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        return duration
      }
    }
    catch {
      // 使用稳定的类别权重作为无效历史数据的回退。
    }
  }

  if (label.startsWith('hmr-guard:')) {
    return 8
  }
  if (label.includes('.e2e.') || label.includes('.integration.')) {
    return 5
  }
  if (label.includes('platform') || label.includes('template')) {
    return 4
  }
  return 2
}

/** 按历史耗时优先的确定性 LPT 算法划分任务，保证 shard 间不重叠。 */
export function partitionE2ETasks<T extends { label: string }>(tasks: T[], options: E2ETaskShardOptions) {
  const { index, total } = options
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
    throw new Error(`Invalid e2e shard: index=${index}, total=${total}`)
  }

  const buckets = Array.from({ length: total }, () => ({ load: 0, tasks: [] as T[] }))
  const weightedTasks = tasks
    .map((task, taskIndex) => ({ task, taskIndex, weight: resolveTaskWeight(task.label) }))
    .sort((left, right) => right.weight - left.weight || left.taskIndex - right.taskIndex)

  for (const entry of weightedTasks) {
    let targetIndex = 0
    for (let bucketIndex = 1; bucketIndex < buckets.length; bucketIndex += 1) {
      if (buckets[bucketIndex].load < buckets[targetIndex].load) {
        targetIndex = bucketIndex
      }
    }
    buckets[targetIndex].tasks.push(entry.task)
    buckets[targetIndex].load += entry.weight
  }

  return buckets[index].tasks.sort((left, right) => tasks.indexOf(left) - tasks.indexOf(right))
}

const HMR_GUARD_CI_TESTS = new Set(
  HMR_GUARD_ALL_TESTS
    .filter(filePath => toRelativeLabel(filePath).startsWith('ci/'))
    .map(toPosixPath),
)

function createVitestTask(configPath: string, filePath: string, label = toRelativeLabel(filePath)): SuiteTask {
  const targetFile = toRelativeLabel(filePath)
  return {
    label,
    command: 'pnpm',
    args: ['vitest', 'run', '-c', configPath],
    env: {
      [E2E_TARGET_FILE_ENV]: targetFile,
    },
  }
}

function createIdeVitestTask(filePath: string) {
  const task = createVitestTask(DEVTOOLS_CONFIG_PATH, filePath)
  if (TEMPLATE_DEV_OPEN_RUNNER_LABELS.has(task.label)) {
    task.command = 'node'
    task.args = ['--import', 'tsx', path.resolve(ROOT, 'scripts/run-template-dev-open-suite.ts')]
    const isMultiTemplate = task.label === 'ide/template-tailwindcss-dev-open-multi.runtime.test.ts'
    task.acceptanceTemplates = TEMPLATE_DEV_OPEN_CASES
      .filter(item => !isMultiTemplate || [
        'weapp-vite-tailwindcss-template',
        'weapp-vite-tailwindcss-vant-template',
        'weapp-vite-tailwindcss-tdesign-template',
      ].includes(item.name))
      .map(item => item.name)
  }
  const taskTimeoutMs = IDE_TASK_TIMEOUT_MS_BY_LABEL.get(task.label)
  if (taskTimeoutMs) {
    task.env = {
      ...task.env,
      [TASK_TIMEOUT_ENV]: taskTimeoutMs,
    }
  }
  if (IDE_BRIDGE_WRAPPER_TEST_LABELS.has(task.label)) {
    task.env = {
      ...task.env,
      [AUTOMATOR_BRIDGE_WRAPPER_ENV]: '1',
    }
  }
  if (IDE_TWO_WINDOW_TEST_LABELS.has(task.label)) {
    task.env = {
      ...task.env,
      [MANAGED_PROJECT_MAX_WINDOWS_ENV]: '2',
    }
  }
  return task
}

function isIdeHelperTest(label: string) {
  return IDE_HELPER_TEST_PATTERNS.has(label)
}

function createHeadlessVitestTask(configPath: string, filePath: string, label = toRelativeLabel(filePath)): SuiteTask {
  const targetFile = toRelativeLabel(filePath)
  const taskTimeoutMs = IDE_TASK_TIMEOUT_MS_BY_LABEL.get(label)
  return {
    label,
    command: 'pnpm',
    args: ['vitest', 'run', '-c', configPath],
    env: {
      [E2E_TARGET_FILE_ENV]: targetFile,
      WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
      ...(taskTimeoutMs ? { [TASK_TIMEOUT_ENV]: taskTimeoutMs } : {}),
    },
  }
}

function getHeadlessPatternTasks(patterns: string[]) {
  return patterns.map(filePath => createHeadlessVitestTask(HEADLESS_CONFIG_PATH, path.resolve(ROOT, filePath)))
}

function getIdeDomHeadlessTasks() {
  return getHeadlessPatternTasks(IDE_DOM_HEADLESS_PATTERNS).map(task => ({
    ...task,
    env: { ...task.env, WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1' },
  }))
}

function createCommandTask(label: string, args: string[]): SuiteTask {
  return {
    label,
    command: 'node',
    args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-hmr-guard-suite.ts'), ...args],
  }
}

export function getDiminaTasks() {
  return [{
    label: 'dimina-web',
    command: 'pnpm',
    args: ['vitest', 'run', '-c', path.resolve(ROOT, 'vitest.e2e.dimina.config.ts')],
  }] satisfies SuiteTask[]
}

export function getWebTasks() {
  return [{
    label: 'web-runtime',
    command: 'pnpm',
    args: ['vitest', 'run', '-c', WEB_CONFIG_PATH],
  }] satisfies SuiteTask[]
}

export async function getCiTasks(_options: SuiteTaskFactoryOptions = {}) {
  const buildOnlyFiles = fg.sync('ci/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .map(toPosixPath)
    .filter(filePath => !HMR_GUARD_CI_TESTS.has(filePath))
    .sort()

  if (process.env[SKIP_CI_HMR_GUARD_ENV] === '1') {
    return buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath))
  }

  const tasks = [
    ...buildOnlyFiles.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    ...HMR_GUARD_UTILITY_TESTS.map(filePath => createVitestTask(CI_CONFIG_PATH, filePath)),
    createCommandTask('hmr-guard:full', ['full', HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION]),
    createCommandTask('hmr-guard:auto-import-vue-sfc', ['auto-import-vue-sfc', HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION]),
    createCommandTask('hmr-guard:auto-routes-hmr', ['auto-routes-hmr', HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION]),
    createCommandTask('hmr-guard:shared-chunks-auto', ['shared-chunks-auto', HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION]),
  ]

  return tasks
}

export async function getCiPrTasks(options: SuiteTaskFactoryOptions = {}) {
  const fullTasks = await getCiTasks({ ...options })
  const taskByLabel = new Map(fullTasks.map(task => [task.label, task]))
  return CI_PR_PATTERNS.map(label => taskByLabel.get(label)).filter((task): task is SuiteTask => task != null)
}

export async function getCiFullTasks(options: SuiteTaskFactoryOptions = {}) {
  const previous = process.env[SKIP_CI_HMR_GUARD_ENV]
  process.env[SKIP_CI_HMR_GUARD_ENV] = '1'
  try {
    return await getCiTasks(options)
  }
  finally {
    if (previous == null) {
      delete process.env[SKIP_CI_HMR_GUARD_ENV]
    }
    else {
      process.env[SKIP_CI_HMR_GUARD_ENV] = previous
    }
  }
}

export function getIdeExhaustiveTasks(options: SuiteTaskFactoryOptions = {}) {
  const topology = resolveVerificationTopology(options.topology)
  const tasks = fg.sync('ide/**/*.test.ts', {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
  })
    .sort()
    .filter(filePath => !isIdeHelperTest(toRelativeLabel(filePath)))
    .filter(filePath => !IDE_MANUAL_DEVTOOLS_TEST_PATTERNS.has(toRelativeLabel(filePath)))
    .filter(filePath => !IDE_GITHUB_ISSUES_AGGREGATED_PATTERN_SET.has(toRelativeLabel(filePath)))
    .filter((filePath) => {
      const label = toRelativeLabel(filePath)
      return topology.id === 'legacy-v1' ? label !== IDE_TDESIGN_AGGREGATE_LABEL : !(IDE_TDESIGN_AGGREGATED_PATTERNS as readonly string[]).includes(label)
    })
    .filter(filePath => !IDE_COMPONENT_LIBRARY_PATTERN_SET.has(toRelativeLabel(filePath)))
    .map((filePath) => {
      const task = createIdeVitestTask(filePath)
      if (IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS.has(task.label)) {
        task.outOfScopeReason = 'Optional Baidu host runtime is outside WeChat DOM acceptance'
      }
      return task
    })

  return tasks.sort((left, right) => {
    const leftIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(left.label)
    const rightIsChunkModes = IDE_CHUNK_MODES_PATTERNS.includes(right.label)
    if (leftIsChunkModes === rightIsChunkModes) {
      return left.label.localeCompare(right.label)
    }
    return leftIsChunkModes ? 1 : -1
  })
}

function getIdePatternTasks(patterns: string[], env: Record<string, string> = {}) {
  return patterns.map((filePath) => {
    const task = createIdeVitestTask(path.resolve(ROOT, filePath))
    task.env = { ...task.env, ...env }
    return task
  })
}

export function getIdeTasks() {
  return getIdePatternTasks(IDE_FULL_CORE_PATTERNS)
}

export function getIdeGateTasks() {
  return IDE_GATE_TESTS.map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))
}

export function getIdeSmokeTasks() {
  return IDE_SMOKE_TESTS.map(filePath => createVitestTask(DEVTOOLS_CONFIG_PATH, filePath))
}

export function getIdeHeadlessSmokeTasks() {
  return getHeadlessPatternTasks([
    'ide/index.test.ts',
    'ide/template-weapp-vite-template.test.ts',
  ])
}

export function getIdeHeadlessGateTasks() {
  return getHeadlessPatternTasks([
    'ide/index.test.ts',
    'ide/app-lifecycle.test.ts',
    'ide/auto-routes-define-app-json.runtime.test.ts',
    'ide/template-weapp-vite-template.test.ts',
    'ide/template-weapp-vite-wevu-template.test.ts',
    'ide/wevu-runtime.weapp.test.ts',
  ])
}

export function getIdeHeadlessTasks() {
  return getHeadlessPatternTasks(IDE_HEADLESS_FULL_TESTS.map(filePath => toRelativeLabel(filePath)))
}

export function getIdeGithubIssuesTasks() {
  return getIdePatternTasks(IDE_GITHUB_ISSUES_PATTERNS)
}

export function getIdeWevuFeaturesTasks() {
  return getIdePatternTasks(IDE_WEVU_FEATURES_PATTERNS)
}

export function getIdeTemplatesTasks() {
  return getIdePatternTasks(IDE_TEMPLATES_PATTERNS)
}

export function getIdeWevuJsxTasks() {
  return getIdePatternTasks(IDE_WEVU_JSX_PATTERNS)
}

export function getIdeChunkModesTasks() {
  return getIdePatternTasks(IDE_CHUNK_MODES_PATTERNS)
}

function getIdeComponentLibraryTasksForMode(mode: 'runtime' | 'visual' | 'visual-full') {
  return getIdePatternTasks(IDE_COMPONENT_LIBRARY_PATTERNS, {
    WEAPP_VITE_COMPONENT_LIBRARY_MODE: mode,
  })
}

export function getIdeComponentLibraryTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('runtime')
}

export function getIdeComponentLibraryVisualTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('visual')
}

export function getIdeComponentLibraryVisualFullTasks(_options: SuiteTaskFactoryOptions = {}) {
  return getIdeComponentLibraryTasksForMode('visual-full')
}

export function getHmrBuildTasks() {
  // 每个文件仍使用独立 Vitest 进程，特例保留隔离，smoke/utility 不再重复。
  return HMR_ACCEPTANCE_BUILD_TESTS.map(file => createVitestTask(CI_CONFIG_PATH, file))
}

export function getHmrIdeTasks() {
  return getIdePatternTasks(hmrAcceptanceRuntimeFiles('ide'), { WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'devtools' })
}

export function getHmrHeadlessTasks() {
  return getHeadlessPatternTasks(hmrAcceptanceRuntimeFiles('headless'))
}

export function getHmrClassicBuildTasks() {
  return getHmrBuildTasks().map(applyClassicSupportScope)
}

export function getHmrClassicIdeTasks() {
  return getHmrIdeTasks().map(applyClassicSupportScope)
}

export function getHmrClassicHeadlessTasks() {
  return getHmrHeadlessTasks().map(applyClassicSupportScope)
}

export function getIdeClassicExhaustiveTasks(options: SuiteTaskFactoryOptions = {}) {
  return getIdeExhaustiveTasks(options).map(applyClassicSupportScope)
}

export async function getCiClassicTasks(options: SuiteTaskFactoryOptions = {}) {
  const tasks = [...await getCiFullTasks(options), ...getHmrBuildTasks()]
  return [...new Map(tasks.map(task => [task.label, task])).values()].map(applyClassicSupportScope)
}

export async function getCiNonHmrClassicTasks(options: SuiteTaskFactoryOptions = {}) {
  const hmrLabels = new Set(getHmrBuildTasks().map(task => task.label))
  return (await getCiFullTasks(options)).filter(task => !hmrLabels.has(task.label)).map(applyClassicSupportScope)
}

export async function getCiPrClassicTasks(options: SuiteTaskFactoryOptions = {}) {
  return (await getCiPrTasks(options)).map(applyClassicSupportScope)
}

export function getHmrRegressionTasks() {
  return [...getHmrBuildTasks(), ...getHmrIdeTasks()]
}

export function getFullTasks() {
  return [
    {
      label: 'e2e:ci',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ci'],
    },
    {
      label: 'e2e:web',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'web'],
    },
    {
      label: 'e2e:ide',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ide-smoke'],
    },
  ] satisfies SuiteTask[]
}

export function getFullRegressionTasks() {
  return [
    {
      label: 'e2e:ci',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'ci'],
    },
    {
      label: 'e2e:web',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-e2e-suite.ts'), 'web'],
    },
    {
      label: 'e2e:ide:full',
      command: 'node',
      args: ['--import', 'tsx', path.resolve(ROOT, 'scripts', 'run-sleep-inhibited-e2e-suite.ts'), 'ide-full'],
    },
  ] satisfies SuiteTask[]
}

export const E2E_SUITES: Record<string, E2ESuiteDefinition> = {
  'bun-headless': {
    name: 'bun-headless',
    description: 'Bun dev output in the headless mini-program runtime',
    tasks: () => [createHeadlessVitestTask(HEADLESS_CONFIG_PATH, path.resolve(ROOT, 'bun/runtime.test.ts'))],
  },
  'bun-devtools': {
    name: 'bun-devtools',
    description: 'Bun dev output in real WeChat DevTools',
    tasks: () => [createVitestTask(DEVTOOLS_CONFIG_PATH, path.resolve(ROOT, 'bun/runtime.test.ts'))],
  },
  'bun': {
    name: 'bun',
    description: 'Bun CLI startup, rebuild and shutdown regression',
    tasks: () => [{
      label: 'bun-cli',
      command: 'pnpm',
      args: ['vitest', 'run', '-c', path.resolve(ROOT, 'vitest.e2e.bun.config.ts')],
    }],
  },
  'ci': {
    name: 'ci',
    description: 'Miniapp CI e2e baseline with aggregated failure summary',
    tasks: getCiTasks,
  },
  'ci:classic': {
    name: 'ci:classic',
    description: 'Complete CI regression with the supported WeChat startup classic watch contracts',
    tasks: getCiClassicTasks,
  },
  'ci-full:classic': {
    name: 'ci-full:classic',
    description: 'Complete CI regression with explicit experimental HMR exclusions',
    tasks: getCiNonHmrClassicTasks,
  },
  'ci-non-hmr:classic': {
    name: 'ci-non-hmr:classic',
    description: 'CI build baseline without duplicated HMR guard execution',
    tasks: getCiNonHmrClassicTasks,
  },
  'ci-pr:classic': {
    name: 'ci-pr:classic',
    description: 'PR build baseline with supported classic HMR cases',
    tasks: getCiPrClassicTasks,
  },
  'ci-pr': {
    name: 'ci-pr',
    description: 'PR miniapp CI smoke suite with core build and runtime coverage',
    tasks: getCiPrTasks,
  },
  'ci-full': {
    name: 'ci-full',
    description: 'Complete miniapp CI suite for nightly and manual matrix runs',
    tasks: getCiFullTasks,
  },
  'dimina': {
    name: 'dimina',
    description: 'Experimental Dimina Web container acceptance',
    tasks: getDiminaTasks,
  },
  'web': {
    name: 'web',
    description: 'Web runtime browser and visual regression suite',
    tasks: getWebTasks,
  },
  'ide': {
    name: 'ide',
    description: 'Alias of ide-smoke for the default faster IDE loop',
    tasks: getIdeSmokeTasks,
  },
  'ide-smoke': {
    name: 'ide-smoke',
    description: 'Smallest stable IDE smoke suite for daily local verification',
    tasks: getIdeSmokeTasks,
  },
  'ide-gate': {
    name: 'ide-gate',
    description: 'Broader IDE gate suite with core runtime coverage',
    tasks: getIdeGateTasks,
  },
  'ide-headless-smoke': {
    name: 'ide-headless-smoke',
    description: 'Smallest headless runtime smoke suite for provider-based IDE assertions',
    tasks: getIdeHeadlessSmokeTasks,
  },
  'ide-headless-gate': {
    name: 'ide-headless-gate',
    description: 'Broader headless runtime gate suite with provider-compatible core coverage',
    tasks: getIdeHeadlessGateTasks,
  },
  'ide-headless-full': {
    name: 'ide-headless-full',
    description: 'Largest provider-compatible IDE suite backed by the headless runtime',
    tasks: getIdeHeadlessTasks,
  },
  'ide-headless-full:classic': {
    name: 'ide-headless-full:classic',
    description: 'Full provider-compatible regression with the supported classic HMR scope',
    tasks: () => getIdeHeadlessTasks().map(applyClassicSupportScope),
  },
  'ide-dom-headless': {
    name: 'ide-dom-headless',
    description: 'Strict rendered checkpoint gate for provider-compatible IDE scenarios',
    tasks: getIdeDomHeadlessTasks,
  },
  'ide-dom-headless:classic': {
    name: 'ide-dom-headless:classic',
    description: 'Strict DOM checkpoints with explicit experimental HMR exclusions',
    tasks: () => getIdeDomHeadlessTasks().map(applyClassicSupportScope),
  },
  'ide-full': {
    name: 'ide-full',
    description: 'PR-oriented full IDE gate with core devtools runtime coverage',
    tasks: getIdeTasks,
  },
  'ide-full:classic': {
    name: 'ide-full:classic',
    description: 'Full IDE gate with the supported startup classic HMR scope',
    tasks: () => getIdeTasks().map(applyClassicSupportScope),
  },
  'ide-full:exhaustive': {
    name: 'ide-full:exhaustive',
    description: 'Nightly exhaustive IDE regression suite across all devtools runtime tests',
    tasks: getIdeExhaustiveTasks,
  },
  'ide-full:exhaustive:classic': {
    name: 'ide-full:exhaustive:classic',
    description: 'Exhaustive IDE inventory with explicit experimental HMR diagnostic exclusions',
    tasks: getIdeClassicExhaustiveTasks,
  },
  'ide-full:github-issues': {
    name: 'ide-full:github-issues',
    description: 'IDE regression suite focused on reproduced GitHub issues',
    tasks: getIdeGithubIssuesTasks,
  },
  'ide-full:wevu-features': {
    name: 'ide-full:wevu-features',
    description: 'IDE regression suite focused on wevu feature runtime coverage',
    tasks: getIdeWevuFeaturesTasks,
  },
  'ide-full:templates': {
    name: 'ide-full:templates',
    description: 'IDE regression suite focused on template runtime coverage',
    tasks: getIdeTemplatesTasks,
  },
  'ide-full:wevu-jsx': {
    name: 'ide-full:wevu-jsx',
    description: 'IDE and stateful HMR regression suite for Wevu JSX/TSX',
    tasks: getIdeWevuJsxTasks,
  },
  'ide-full:chunk-modes': {
    name: 'ide-full:chunk-modes',
    description: 'IDE regression suite focused on chunk-modes runtime matrix coverage',
    tasks: getIdeChunkModesTasks,
  },
  'ide-component-libraries': {
    name: 'ide-component-libraries',
    description: 'Long-running IDE visual and runtime coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryTasks,
  },
  'ide-component-libraries:visual': {
    name: 'ide-component-libraries:visual',
    description: 'Representative IDE visual coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryVisualTasks,
  },
  'ide-component-libraries:visual-full': {
    name: 'ide-component-libraries:visual-full',
    description: 'Full IDE visual coverage for uview-plus and wot-ui',
    tasks: getIdeComponentLibraryVisualFullTasks,
  },
  'hmr-regression': {
    name: 'hmr-regression',
    description: 'Complete HMR regression flow: IDE template HMR plus CI dev-watch HMR guards',
    tasks: getHmrRegressionTasks,
  },
  'hmr-build': {
    name: 'hmr-build',
    description: 'Complete HMR build and watch contracts, including automatic routes and classic fallback',
    tasks: getHmrBuildTasks,
  },
  'hmr-build:classic': {
    name: 'hmr-build:classic',
    description: 'Supported classic build and watch contracts with the complete diagnostic inventory retained',
    tasks: getHmrClassicBuildTasks,
  },
  'ide-hmr-headless': {
    name: 'ide-hmr-headless',
    description: 'Strict provider-compatible HMR support and classic fallback checkpoints',
    tasks: getHmrHeadlessTasks,
  },
  'ide-hmr-headless:classic': {
    name: 'ide-hmr-headless:classic',
    description: 'Strict provider-compatible startup classic HMR acceptance',
    tasks: getHmrClassicHeadlessTasks,
  },
  'ide-hmr': {
    name: 'ide-hmr',
    description: 'Strict real WeChat IDE HMR support and automatic classic reload acceptance',
    tasks: getHmrIdeTasks,
  },
  'ide-hmr:classic': {
    name: 'ide-hmr:classic',
    description: 'Strict real WeChat IDE startup classic reload acceptance',
    tasks: getHmrClassicIdeTasks,
  },
  'full': {
    name: 'full',
    description: 'Default regression entry: ci plus web plus ide smoke',
    tasks: getFullTasks,
  },
  'full-regression': {
    name: 'full-regression',
    description: 'Full regression entry: ci plus web plus ide full',
    tasks: getFullRegressionTasks,
  },
  'hmr-shared-chunks-auto': {
    name: 'hmr-shared-chunks-auto',
    description: 'Single CI special-case HMR verification',
    tasks: () => [createVitestTask(CI_CONFIG_PATH, HMR_GUARD_SPECIAL_CASES.sharedChunksAuto)],
  },
  'hmr-auto-import-vue-sfc': {
    name: 'hmr-auto-import-vue-sfc',
    description: 'Single CI special-case HMR verification for auto-import Vue SFC',
    tasks: () => [createVitestTask(CI_CONFIG_PATH, HMR_GUARD_SPECIAL_CASES.autoImportVueSfc)],
  },
}

export async function listE2ESuites() {
  return await Promise.all(Object.values(E2E_SUITES).map(async (suite) => {
    const tasks = await suite.tasks({ skipDiskBackedDevProbe: true })
    return {
      name: suite.name,
      description: suite.description,
      taskCount: tasks.length,
      labels: tasks.map(task => task.label),
    }
  }))
}

export async function getSuiteTasks(mode: string, options: SuiteTaskFactoryOptions = {}) {
  const topology = resolveVerificationTopology(options.topology)
  const tasks = await E2E_SUITES[mode]?.tasks({ ...options, topology: topology.id }) ?? []
  return tasks.map(task => ({ ...task, env: { ...task.env, ...topologyEnvironment(topology) } }))
}
