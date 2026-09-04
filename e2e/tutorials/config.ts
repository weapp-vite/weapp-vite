import path from 'node:path'

export const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
export const HANDBOOK_SNIPPET_PATH = path.join(
  REPO_ROOT,
  'website/snippets/tutorial-e2e/handbook-counter.vue',
)

export const TUTORIAL_SCENARIO_IDS = [
  'guide-create',
  'handbook-wevu-counter',
  'multi-platform',
] as const

export type TutorialScenarioId = typeof TUTORIAL_SCENARIO_IDS[number]
export type TutorialSource = 'npm' | 'workspace'
export type TutorialPackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'
export type TutorialRuntimeProvider = 'devtools' | 'headless'

export interface TutorialCommand {
  args: string[]
  command: string
}

export interface TutorialScenarioRun {
  id: string
  packageManager: TutorialPackageManager
  scenario: TutorialScenarioId
  source: TutorialSource
  template: string
}

export const MINIAPP_PLATFORM_OUTPUTS = {
  alipay: {
    appStyle: 'app.acss',
    pageStyle: 'pages/index/index.acss',
    pageTemplate: 'pages/index/index.axml',
  },
  jd: {
    appStyle: 'app.jxss',
    pageStyle: 'pages/index/index.jxss',
    pageTemplate: 'pages/index/index.jxml',
  },
  swan: {
    appStyle: 'app.css',
    pageStyle: 'pages/index/index.css',
    pageTemplate: 'pages/index/index.swan',
  },
  tt: {
    appStyle: 'app.ttss',
    pageStyle: 'pages/index/index.ttss',
    pageTemplate: 'pages/index/index.ttml',
  },
  weapp: {
    appStyle: 'app.wxss',
    pageStyle: 'pages/index/index.wxss',
    pageTemplate: 'pages/index/index.wxml',
  },
  xhs: {
    appStyle: 'app.css',
    pageStyle: 'pages/index/index.css',
    pageTemplate: 'pages/index/index.xhsml',
  },
} as const

export type MiniappTutorialPlatform = keyof typeof MINIAPP_PLATFORM_OUTPUTS

export const MULTI_PLATFORM_TEMPLATES = [
  'multi-platform',
  'multi-platform-sfc',
] as const

export const TUTORIAL_DOC_CONTRACTS = [
  {
    file: 'website/guide/index.md',
    marker: 'guide-create',
    required: [
      'pnpm create weapp-vite',
      'yarn create weapp-vite',
      'npm create weapp-vite@latest',
      'bun create weapp-vite',
      'pnpm dev',
      'pnpm build',
    ],
  },
  {
    file: 'website/handbook/index.md',
    marker: 'handbook-wevu-counter',
    required: [
      'pnpm create weapp-vite my-app wevu --no-install-skills',
      'src/pages/index/index.vue',
      'pages/index/index',
      'website/snippets/tutorial-e2e/handbook-counter.vue',
    ],
  },
  {
    file: 'website/guide/multi-platform.md',
    marker: 'multi-platform',
    required: [
      'my-app multi-platform',
      'my-app multi-platform-sfc',
      'pnpm build:weapp',
      'pnpm build:alipay',
      'pnpm build:tt',
      'pnpm build:swan',
      'pnpm build:jd',
      'pnpm build:xhs',
      'pnpm build:web',
    ],
  },
] as const

export const WORKSPACE_PACKAGE_DIRS = {
  '@weapp-vite/dashboard': 'packages/dashboard',
  '@weapp-vite/eslint': 'packages/eslint',
  '@weapp-vite/react': 'packages-runtime/react',
  'weapp-vite': 'packages/weapp-vite',
  'wevu': 'packages-runtime/wevu',
} as const

export function createTutorialRuns(
  source: TutorialSource,
  selectedScenarios: readonly TutorialScenarioId[] = TUTORIAL_SCENARIO_IDS,
) {
  const selected = new Set(selectedScenarios)
  const runs: TutorialScenarioRun[] = []

  if (selected.has('guide-create')) {
    const packageManagers: TutorialPackageManager[] = source === 'npm'
      ? ['pnpm', 'npm', 'yarn', 'bun']
      : ['pnpm']
    for (const packageManager of packageManagers) {
      runs.push({
        id: `guide-create/${packageManager}`,
        packageManager,
        scenario: 'guide-create',
        source,
        template: 'default',
      })
    }
  }

  if (selected.has('handbook-wevu-counter')) {
    runs.push({
      id: 'handbook-wevu-counter/pnpm',
      packageManager: 'pnpm',
      scenario: 'handbook-wevu-counter',
      source,
      template: 'wevu',
    })
  }

  if (selected.has('multi-platform')) {
    for (const template of MULTI_PLATFORM_TEMPLATES) {
      runs.push({
        id: `multi-platform/${template}`,
        packageManager: 'pnpm',
        scenario: 'multi-platform',
        source,
        template,
      })
    }
  }

  return runs
}
