/* eslint-disable e18e/ban-dependencies -- 使用跨平台子进程解析 pnpm/git 命令。 */
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { cacheRoot, root, upstreamCommit, upstreamRoot } from '../config'
import { preparationInputs, preparedRoot } from './preparation'
import { recordPreparedAssets } from './preparedAssets'
import { prepareInstallation } from './prepareSource'
import { prepareToolchain } from './toolchain'
import { testUpstream } from './upstreamTests'

const run = (command: string, args: string[], cwd: string) => execa(command, args, { cwd, stdio: 'inherit' })
async function installDependencies(buildRoot: string) {
  const pnpm = await prepareToolchain(buildRoot)
  const cwd = path.join(buildRoot, 'fe')
  await cp(path.join(root, 'upstream/pnpm-lock.yaml'), path.join(cwd, 'pnpm-lock.yaml'))
  await pnpm(['install', '--frozen-lockfile'], cwd)
  return pnpm
}
const [major, minor, patch] = process.versions.node.split('.').map(Number)
if (major! < 22 || (major === 22 && (minor! < 22 || (minor === 22 && patch! < 3)))) {
  throw new Error('Dimina requires Node.js >=22.22.3')
}
if (process.argv.includes('--reuse')) {
  let cached: string | undefined
  try {
    cached = await preparedRoot(root, cacheRoot, { allowMissingDependencies: true })
  }
  catch { console.log('No complete matching SDK cache; preparing fresh source.') }
  if (cached) {
    try {
      // 缓存仅保存源码与构建产物；依赖链接必须由当前 runner 的包管理器重建。
      await installDependencies(cached)
      await testUpstream(cached)
    }
    catch (error) {
      await rm(path.join(cacheRoot, 'ready.json'), { force: true })
      throw error
    }
    console.log('Verified cached Dimina compiler and Web SDK.')
    process.exit(0)
  }
}
await mkdir(cacheRoot, { recursive: true })
await rm(path.join(cacheRoot, 'ready.json'), { force: true })
try {
  await readFile(path.join(upstreamRoot, '.git/HEAD'))
}
catch {
  await run('git', ['clone', '--filter=blob:none', 'https://github.com/didi/dimina.git', upstreamRoot], cacheRoot)
}
const status = await execa('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: upstreamRoot })
if (status.stdout.trim()) {
  throw new Error('Dimina source cache has local changes; preserve them before running setup again.')
}
await run('git', ['fetch', 'origin', upstreamCommit], upstreamRoot)
await run('git', ['checkout', '--detach', upstreamCommit], upstreamRoot)
const inputs = await preparationInputs()
await prepareInstallation({ source: upstreamRoot, cache: cacheRoot, commit: upstreamCommit, ...inputs }, async (buildRoot) => {
  const pnpm = await installDependencies(buildRoot)
  const cwd = path.join(buildRoot, 'fe')
  await pnpm(['--filter', '@dimina/compiler', '--filter', '@dimina/fe-container-sdk^...', 'build'], cwd)
  await testUpstream(buildRoot)
  // 上游库构建保留了 Vue 的环境分支；独立浏览器资源需在编译期明确替换。
  await pnpm(['exec', 'node', '--input-type=module', '--eval', `
  import { build } from 'vite';
  await build({ define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  } });
`], path.join(cwd, 'packages/container-sdk'))
  await pnpm(['exec', 'tsc', '-p', 'tsconfig.build.json'], path.join(cwd, 'packages/container-sdk'))
  await recordPreparedAssets(buildRoot)
})
console.log('Dimina compiler and Web SDK are ready.')
