import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runAggregateBuild() {
  buildState.standardBuildPromise = null
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues:aggregate',
    skipNpm: true,
    env: {
      WEAPP_VITE_E2E_TARGET_FILE: 'e2e/ide/github-issues.runtime.aggregate.test.ts',
    },
  })

  buildState.distVariant = null
}
