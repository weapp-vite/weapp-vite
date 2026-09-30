/* eslint-disable e18e/ban-dependencies -- 使用跨平台子进程解析 pnpm/git 命令。 */
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { cacheRoot, root, upstreamCommit, upstreamRoot } from '../config'
import { preparationInputs } from './preparation'
import { prepareInstallation } from './prepareSource'

const run = (command: string, args: string[], cwd: string) => execa(command, args, { cwd, stdio: 'inherit' })
const [major, minor, patch] = process.versions.node.split('.').map(Number)
if (major! < 22 || (major === 22 && (minor! < 22 || (minor === 22 && patch! < 3)))) {
  throw new Error('Dimina requires Node.js >=22.22.3')
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
  const cwd = path.join(buildRoot, 'fe')
  await cp(path.join(root, 'upstream/pnpm-lock.yaml'), path.join(cwd, 'pnpm-lock.yaml'))
  await run('pnpm', ['install', '--frozen-lockfile'], cwd)
  await run('pnpm', ['--filter', '@dimina/compiler', '--filter', '@dimina/fe-container-sdk^...', 'build'], cwd)
  await run('pnpm', ['exec', 'vitest', 'run', '__tests__/component-generics.spec.js', '__tests__/virtual-host-metadata.spec.js', '__tests__/real-component-lifecycle.spec.js'], path.join(cwd, 'packages/render'))
  // 上游库构建保留了 Vue 的环境分支；独立浏览器资源需在编译期明确替换。
  await run('pnpm', ['exec', 'node', '--input-type=module', '--eval', `
  import { build } from 'vite';
  await build({ define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  } });
`], path.join(cwd, 'packages/container-sdk'))
  await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], path.join(cwd, 'packages/container-sdk'))
})
console.log('Dimina compiler and Web SDK are ready.')
