import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 fixture 使用真实 pnpm 建立本地入口与 bin，不触及仓库安装。
import { execa } from 'execa'

const require = createRequire(import.meta.url)
const fixturePackages = ['vitest', '@vitest/coverage-v8']

/** 只链接已安装的公共入口，保留独立工作区、安装状态与原始 coverage 命令。 */
export async function preparePnpmVitestFixture(directory, manifest) {
  const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  const devDependencies = Object.fromEntries(fixturePackages.map((name) => {
    const packageRoot = path.dirname(require.resolve(`${name}/package.json`))
    return [name, `link:${path.relative(directory, packageRoot).replaceAll('\\', '/')}`]
  }))
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ ...manifest, packageManager, devDependencies }))
  await writeFile(path.join(directory, 'pnpm-workspace.yaml'), 'packages: []\nverifyDepsBeforeRun: error\n')
  const args = ['--dir', directory, 'install', '--offline', '--ignore-scripts']
  await execa('pnpm', [...args, '--lockfile-only'], { cwd: directory })
  await execa('pnpm', [...args, '--frozen-lockfile'], { cwd: directory })
}
