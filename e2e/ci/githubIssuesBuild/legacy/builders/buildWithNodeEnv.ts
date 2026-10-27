import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from '../constants'

export async function runBuildWithNodeEnv(nodeEnv: string) {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    env: { NODE_ENV: nodeEnv },
    label: `ci:github-issues-node-env-${nodeEnv}`,
    skipNpm: true,
  })
}
