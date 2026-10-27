import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, ISSUE_724_DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runIssue724Build() {
  buildState.standardBuildPromise = null
  await fs.remove(ISSUE_724_DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues:issue724',
    outDir: 'dist-issue-724',
    skipNpm: true,
    env: {
      WEAPP_GITHUB_ISSUE_724_PROBE: 'true',
    },
  })

  buildState.distVariant = null
}
