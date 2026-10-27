import { fs } from '@weapp-core/shared/node'
// eslint-disable-next-line e18e/ban-dependencies -- 保留历史构建命令的跨平台启动与环境语义。
import { execa } from 'execa'
import path from 'pathe'
import { sanitizeBuildCommandEnv } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, ISSUE_595_DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runIssue595ScopedBuild() {
  await fs.remove(ISSUE_595_DIST_ROOT)

  await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--scope',
    'main,subpackages/item',
    '--config',
    path.join(APP_ROOT, 'weapp-vite.config.ts'),
  ], {
    stdio: 'inherit',
    env: {
      ...sanitizeBuildCommandEnv(),
      WEAPP_GITHUB_ISSUE_595_SCOPED: 'true',
    },
  })

  buildState.standardBuildPromise = null
  buildState.distVariant = null
}
