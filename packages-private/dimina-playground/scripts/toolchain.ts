/* eslint-disable e18e/ban-dependencies -- 隔离安装并验证上游固定版本的原生 pnpm。 */
import { cp, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import { root } from '../config'

export async function prepareToolchain(buildRoot: string) {
  const directory = path.join(buildRoot, 'toolchain')
  await mkdir(directory)
  for (const file of ['package.json', 'package-lock.json', 'pnpm-workspace.yaml']) {
    await cp(path.join(root, 'upstream/toolchain', file), path.join(directory, file))
  }
  // pnpm 12 的可执行文件由安装脚本准备；包管理器自动切换会跳过该步骤。
  await execa('npm', ['ci', '--ignore-scripts=false', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' })
  const executable = path.join(directory, 'node_modules/pnpm/pnpm.exe')
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as { dependencies: { pnpm: string } }
  const expected = manifest.dependencies.pnpm
  const actual = await execa(executable, ['--version'], { cwd: directory })
  if (actual.stdout.trim() !== expected) {
    throw new Error(`Dimina requires pnpm ${expected}; prepared toolchain returned ${actual.stdout.trim()}`)
  }
  console.log(`Prepared isolated pnpm ${expected}`)
  return (args: string[], cwd: string) => execa(executable, args, {
    cwd,
    localDir: directory,
    preferLocal: true,
    stdio: 'inherit',
  })
}
