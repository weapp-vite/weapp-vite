import type { TutorialScenarioId, TutorialSource } from './config'
import process from 'node:process'
import { REPO_ROOT } from './config'
import { runLoggedCommand } from './lifecycle'

interface TutorialPreparationOptions {
  scenarios: TutorialScenarioId[]
  source: TutorialSource
}

/** 分别准备被测 workspace 包与仓库验收容器的运行依赖。 */
export async function prepareTutorialWorkspace(options: TutorialPreparationOptions, log: (message: string) => void) {
  if (options.source === 'workspace' && process.env.TUTORIAL_E2E_SKIP_WORKSPACE_BUILD !== '1') {
    await runLoggedCommand({
      command: { args: ['build:pkgs:ci'], command: 'pnpm' },
      cwd: REPO_ROOT,
      label: 'tutorial workspace package build',
      log,
      timeoutMs: 30 * 60 * 1000,
    })
    process.stdout.write('dist sync: rebuilt weapp-vite before downstream validation\n')
    return
  }

  if (options.scenarios.every(scenario => scenario === 'guide-create')) {
    return
  }

  // npm 教程依然使用仓库 simulator 源码验收；其包导入必须已有 dist。
  // 使用依赖图选择器，避免以后新增依赖时维护第二份硬编码包清单。
  await runLoggedCommand({
    command: { args: ['--filter', '@mpcore/simulator^...', '--if-present', 'run', 'build'], command: 'pnpm' },
    cwd: REPO_ROOT,
    label: 'tutorial runtime harness dependency build',
    log,
    timeoutMs: 10 * 60 * 1000,
  })
}
