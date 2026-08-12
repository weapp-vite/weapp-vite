/* eslint-disable e18e/ban-dependencies -- 测试辅助入口需要跨平台启动官方开发者工具。 */
import process from 'node:process'
import { execa } from 'execa'
import path from 'pathe'
import { diagnosePlatformRuntime } from './platform-runtime-doctor'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const PROJECT_ROOT = path.join(REPO_ROOT, 'apps/douyin-native-demo')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

async function main() {
  const diagnostic = await diagnosePlatformRuntime('tt')
  if (!diagnostic.ready) {
    throw new Error(diagnostic.reason)
  }
  if (process.platform !== 'darwin') {
    throw new Error('抖音开发者工具测试辅助入口当前只支持 macOS。')
  }

  await execa(process.execPath, [CLI_PATH, 'build', PROJECT_ROOT, '--platform', 'tt'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  await execa('open', ['-a', '抖音开发者工具'], {
    cwd: REPO_ROOT,
  })
  process.stdout.write(`${JSON.stringify({
    platform: 'tt',
    project: 'apps/douyin-native-demo',
    importRoot: 'apps/douyin-native-demo',
    simulator: 'sandbox-app',
  })}\n`)
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[douyin-devtools-open] failed: ${detail}\n`)
  process.exitCode = 1
})
