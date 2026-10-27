import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, ISSUE_850_DIST_ROOT } from '../constants'

export async function runIssue850Build() {
  await fs.remove(ISSUE_850_DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues:issue850',
    skipNpm: true,
    env: {
      WEAPP_GITHUB_ISSUE_850_OUTPUT_REPLAY: 'true',
    },
  })
}
