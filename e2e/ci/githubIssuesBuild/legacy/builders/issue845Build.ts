import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, ISSUE_845_DIST_ROOT } from '../constants'

export async function runIssue845Build() {
  await fs.remove(ISSUE_845_DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues:issue845',
    skipNpm: true,
    env: {
      WEAPP_GITHUB_ISSUE_845_I18N: 'true',
    },
  })
}
