import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
// eslint-disable-next-line e18e/ban-dependencies -- 保留历史构建命令的跨平台启动与环境语义。
import { execa } from 'execa'
import path from 'pathe'
import { APP_ROOT, CLI_PATH, ISSUE_393_DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runIssue393Build() {
  await fs.remove(ISSUE_393_DIST_ROOT)

  await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(APP_ROOT, 'weapp-vite.config.ts'),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WEAPP_GITHUB_ISSUE_393: 'true',
    },
  })

  buildState.standardBuildPromise = null
  buildState.distVariant = null
}
