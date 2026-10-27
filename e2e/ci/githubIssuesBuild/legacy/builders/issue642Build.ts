import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, ISSUE_642_DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runIssue642Build() {
  buildState.standardBuildPromise = null
  await fs.remove(ISSUE_642_DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues:issue642',
    outDir: 'dist-issue-642',
    skipNpm: true,
    env: {
      WEAPP_VITE_E2E_TARGET_FILE: 'e2e/ide/github-issues.runtime.issue642.test.ts',
      WEAPP_GITHUB_ISSUE_642_SCOPED: 'true',
    },
  })

  buildState.distVariant = null
}
