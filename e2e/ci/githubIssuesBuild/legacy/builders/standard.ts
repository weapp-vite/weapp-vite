import { fs } from '@weapp-core/shared/node'
// eslint-disable-next-line e18e/ban-dependencies -- 保留历史构建命令的跨平台启动与环境语义。
import { execa } from 'execa'
import path from 'pathe'
import { runWeappViteBuildWithLogCapture, sanitizeBuildCommandEnv } from '../../../../utils/buildLog'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from '../constants'
import { buildState } from './state'

export async function runBuild() {
  if (buildState.distVariant !== 'standard' || !await fs.pathExists(path.join(DIST_ROOT, 'app.json'))) {
    buildState.standardBuildPromise = null
  }

  buildState.standardBuildPromise ??= (async () => {
    await fs.remove(DIST_ROOT)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ci:github-issues',
      skipNpm: true,
    })
  })()

  await buildState.standardBuildPromise
  buildState.distVariant = 'standard'
}

export async function runBuildWithSourcemap() {
  buildState.standardBuildPromise = null
  await fs.remove(DIST_ROOT)

  await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--sourcemap',
  ], {
    cwd: APP_ROOT,
    extendEnv: false,
    env: sanitizeBuildCommandEnv(),
    stdio: 'inherit',
  })

  buildState.distVariant = 'sourcemap'
}
