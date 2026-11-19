import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 fixture 使用真实 pnpm 建立本地入口与 bin，不触及仓库安装。
import { execa } from 'execa'
import { parseAllDocuments, stringify } from 'yaml'

const require = createRequire(import.meta.url)
const fixturePackages = ['vitest', '@vitest/coverage-v8']

/** 只复用主锁冻结的包管理器解析，不继承工作区配置依赖或项目依赖。 */
export function createPnpmVitestFixtureLock(packageManager, source) {
  const [environmentDocument] = parseAllDocuments(source)
  if (!environmentDocument || environmentDocument.errors.length) {
    throw new Error('pnpm fixture requires a valid repository environment lockfile')
  }
  const environment = environmentDocument.toJS()
  const lockedManager = environment?.importers?.['.']?.packageManagerDependencies?.pnpm
  if (`pnpm@${lockedManager?.specifier}` !== packageManager) {
    throw new Error(`pnpm fixture environment lock does not match ${packageManager}`)
  }
  // 复用冻结的包管理器解析，避免离线安装再次查询 registry；不继承仓库的配置依赖。
  environment.importers = { '.': { configDependencies: {}, packageManagerDependencies: { pnpm: lockedManager } } }
  return `---\n${stringify(environment)}---\n${stringify({ lockfileVersion: environment.lockfileVersion })}`
}

/** 只链接已安装的公共入口，保留独立工作区、安装状态与原始 coverage 命令。 */
export async function preparePnpmVitestFixture(directory, manifest) {
  const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  const lockfile = createPnpmVitestFixtureLock(packageManager, await readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8'))
  // 在仓库内冻结已选版本，避免临时目录命中 PATH 中另一版本的 pnpm。
  const probe = await execa('pnpm', ['exec', process.execPath, '--eval', 'process.stdout.write(process.env.npm_execpath ?? "")'], { cwd: fileURLToPath(new URL('../../', import.meta.url)) })
  const entry = probe.stdout.trim()
  if (!path.isAbsolute(entry)) {
    throw new Error('pnpm fixture requires the actual package-manager entrypoint')
  }
  const managerRequire = createRequire(entry)
  const devDependencies = Object.fromEntries([...fixturePackages, 'pnpm'].map((name) => {
    const packageRoot = path.dirname((name === 'pnpm' ? managerRequire : require).resolve(`${name}/package.json`))
    return [name, `link:${path.relative(directory, packageRoot).replaceAll('\\', '/')}`]
  }))
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ ...manifest, packageManager, devDependencies }))
  await writeFile(path.join(directory, 'pnpm-workspace.yaml'), 'packages: []\nverifyDepsBeforeRun: error\npmOnFail: error\n')
  await writeFile(path.join(directory, 'pnpm-lock.yaml'), lockfile)
  const env = { PATH: [path.join(directory, 'node_modules/.bin'), process.env.PATH].filter(Boolean).join(path.delimiter) }
  const nodeEntry = /\.[cm]?js$/i.test(entry)
  const runPnpm = (commandArgs, options = {}) => execa(nodeEntry ? process.execPath : entry, nodeEntry ? [entry, ...commandArgs] : commandArgs, { ...options, cwd: directory, env: { ...env, ...options.env } })
  const args = ['install', '--offline', '--ignore-scripts']
  await runPnpm([...args, '--lockfile-only'])
  await runPnpm([...args, '--frozen-lockfile'])
  return { runPnpm, env }
}
