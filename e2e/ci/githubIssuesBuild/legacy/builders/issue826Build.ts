import { fs } from '@weapp-core/shared/node'
import { runWeappViteBuildWithLogCapture } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, issue826DistRoot } from '../constants'
import { buildState } from './state'

export async function runIssue826Build(jsFormat: 'cjs' | 'esm') {
  const distRoot = issue826DistRoot(jsFormat)
  await fs.remove(distRoot)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    jsFormat,
    label: `ci:github-issues:issue826:${jsFormat}`,
    outDir: `dist-issue-826-${jsFormat}`,
    skipNpm: true,
    env: {
      WEAPP_GITHUB_ISSUE_826_PRESERVE: 'true',
      WEAPP_GITHUB_ISSUE_826_OUT_DIR: `dist-issue-826-${jsFormat}`,
    },
  })

  buildState.standardBuildPromise = null
  buildState.distVariant = null
}
