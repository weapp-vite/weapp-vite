import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 打包阶段需要跨平台解析 pnpm 启动器。
import { execa } from 'execa'

const manifestName = 'consumer-tarballs.json'

/** 所有子进程共用物理目录，避免 Windows 临时目录的 8.3 别名与监听事件长路径混用。 */
export async function createConsumerTemporaryRoot(parent = os.tmpdir()) {
  return realpath(await mkdtemp(path.join(parent, 'weapp-vite-host-install-')))
}

/** 打包完整运行时 workspace 闭包，支持在切换到消费者最低 Node 版本前执行。 */
export async function packConsumerTarballs(repoRoot, destination, entryPackages = ['weapp-vite', 'wevu']) {
  await mkdir(destination, { recursive: true })
  const listing = await execa('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { cwd: repoRoot })
  const projects = new Map(JSON.parse(listing.stdout).map(project => [project.name, project.path]))
  const packages = {}
  const pending = [...entryPackages]
  while (pending.length) {
    const name = pending.pop()
    if (packages[name]) {
      continue
    }
    const projectRoot = projects.get(name)
    assert(projectRoot, `Missing workspace dependency: ${name}`)
    const manifest = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
    assert.notEqual(manifest.private, true, `Cannot publish private runtime dependency: ${name}`)
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, specifier] of Object.entries(manifest[section] ?? {})) {
        if (specifier.startsWith('workspace:')) {
          pending.push(dependency)
        }
      }
    }
    const file = `${name.replaceAll('/', '-')}.tgz`
    await execa('pnpm', ['--filter', name, 'pack', '--out', path.join(destination, file)], { cwd: repoRoot })
    packages[name] = { file, version: manifest.version }
  }
  await writeFile(path.join(destination, manifestName), `${JSON.stringify({ schemaVersion: 1, packages }, null, 2)}\n`)
  return readConsumerTarballs(destination, entryPackages)
}

/** 消费阶段仅读取 tarball 清单，不从源码仓库重新打包或回退解析。 */
export async function readConsumerTarballs(directory, entryPackages = ['weapp-vite', 'wevu']) {
  const manifest = JSON.parse(await readFile(path.join(directory, manifestName), 'utf8'))
  assert.equal(manifest.schemaVersion, 1, 'Unsupported consumer tarball manifest')
  const dependencies = {}
  for (const [name, entry] of Object.entries(manifest.packages)) {
    assert.equal(path.posix.basename(entry.file), entry.file, `Invalid tarball filename: ${name}`)
    assert.equal(path.win32.basename(entry.file), entry.file, `Invalid tarball filename: ${name}`)
    assert(entry.file.endsWith('.tgz'), `Expected a tarball: ${name}`)
    const file = path.resolve(directory, entry.file)
    assert((await stat(file)).isFile(), `Expected a tarball file: ${name}`)
    dependencies[name] = `file:${file.replaceAll('\\', '/')}`
  }
  for (const name of entryPackages) {
    assert(dependencies[name], `Missing packed entry: ${name}`)
  }
  return dependencies
}

/** 校验完整安装闭包仍来自候选 tarball，禁止注册表旧包或源码链接混入验收。 */
export async function verifyConsumerTarballProvenance(consumerRoot, candidates) {
  const lock = JSON.parse(await readFile(path.join(consumerRoot, 'package-lock.json'), 'utf8'))
  assert(lock.packages, 'Missing installed package provenance')
  for (const name of Object.keys(candidates)) {
    assert(lock.packages[`node_modules/${name}`], `Missing installed candidate: ${name}`)
  }
  let verified = 0
  for (const [location, entry] of Object.entries(lock.packages)) {
    const name = location.split('node_modules/').at(-1)
    const expected = candidates[name]
    if (!expected) {
      continue
    }
    assert(!entry.link && entry.resolved?.startsWith('file:'), `Candidate did not resolve to a tarball: ${location}`)
    assert.equal(path.resolve(consumerRoot, entry.resolved.slice(5)), path.resolve(expected.slice(5)), `Candidate resolved to a different archive: ${location}`)
    verified++
  }
  return verified
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv[2], 'Usage: node consumerTarballs.mjs <destination>')
  await packConsumerTarballs(fileURLToPath(new URL('../../../', import.meta.url)), path.resolve(process.argv[2]))
}
