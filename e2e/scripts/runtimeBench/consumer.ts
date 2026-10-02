import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 独立消费者安装需要跨平台 npm 启动器。
import { execa } from 'execa'
import { readConsumerTarballs, verifyConsumerTarballProvenance } from '../../../packages/weapp-vite/scripts/consumerTarballs.mjs'

export const consumerManifestName = 'runtime-bench-consumer.json'

function isInside(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

/** 独立消费必须从消费者自身的物理 node_modules 解析，禁止 workspace 链接回退。 */
export async function resolveConsumerCli(projectRoot: string) {
  const physicalRoot = await fs.realpath(projectRoot)
  const modulesRoot = path.join(physicalRoot, 'node_modules')
  const require = createRequire(path.join(physicalRoot, 'package.json'))
  const manifestPath = await fs.realpath(require.resolve('weapp-vite/package.json'))
  assert(isInside(modulesRoot, manifestPath), 'Consumer CLI resolved outside its node_modules')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { bin?: Record<string, string> }
  assert(manifest.bin?.['weapp-vite'], 'Missing published weapp-vite CLI')
  const cli = await fs.realpath(path.resolve(path.dirname(manifestPath), manifest.bin['weapp-vite']))
  assert(isInside(modulesRoot, cli), 'Consumer CLI resolved outside its node_modules')
  return cli
}

export async function collectFiles(root: string, relative = ''): Promise<Array<{ path: string, bytes: number, sha256: string }>> {
  const files: Array<{ path: string, bytes: number, sha256: string }> = []
  for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, entry.name)
    assert(!entry.isSymbolicLink(), `Benchmark input/output cannot be a symlink: ${name}`)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, name))
    }
    else {
      const contents = await fs.readFile(path.join(root, name))
      files.push({ path: name, bytes: contents.length, sha256: createHash('sha256').update(contents).digest('hex') })
    }
  }
  return files
}

export async function verifyRuntimeBenchConsumer(projectRoot: string) {
  const metadata = JSON.parse(await fs.readFile(path.join(projectRoot, consumerManifestName), 'utf8')) as { schemaVersion: number, candidates: Record<string, string> }
  assert.equal(metadata.schemaVersion, 1, 'Unsupported runtime benchmark consumer')
  await verifyConsumerTarballProvenance(projectRoot, metadata.candidates)
  for (const name of Object.keys(metadata.candidates)) {
    const physical = await fs.realpath(path.join(projectRoot, 'node_modules', name))
    assert(isInside(await fs.realpath(path.join(projectRoot, 'node_modules')), physical), `Candidate escaped consumer: ${name}`)
  }
  return resolveConsumerCli(projectRoot)
}

export async function createRuntimeBenchConsumer(options: { root: string, fixtureRoot: string, tarballDirectory: string }) {
  const candidates = await readConsumerTarballs(options.tarballDirectory) as Record<string, string>
  await fs.mkdir(options.root, { recursive: true })
  for (const entry of ['src', 'vite.config.ts', 'tsconfig.json', 'project.config.json', 'project.private.config.json']) {
    await fs.cp(path.join(options.fixtureRoot, entry), path.join(options.root, entry), { recursive: true })
  }
  await fs.writeFile(path.join(options.root, 'package.json'), `${JSON.stringify({
    name: 'runtime-bench-vue',
    private: true,
    type: 'module',
    scripts: { postinstall: 'weapp-vite prepare' },
    devDependencies: {
      ...candidates,
      'miniprogram-api-typings': '^5.0.0',
      'typescript': '^5.0.0',
      'vue': '^3.5.0',
    },
  }, null, 2)}\n`)
  const startedAt = Date.now()
  await execa('npm', ['install', '--strict-peer-deps', '--no-audit', '--no-fund'], {
    cwd: options.root,
    env: {
      NODE_PATH: '',
      npm_config_legacy_peer_deps: 'false',
      npm_config_force: 'false',
      npm_config_ignore_scripts: 'false',
      npm_config_engine_strict: 'true',
    },
  })
  const installMs = Date.now() - startedAt
  await fs.writeFile(path.join(options.root, consumerManifestName), `${JSON.stringify({ schemaVersion: 1, candidates })}\n`)
  const cliPath = await verifyRuntimeBenchConsumer(options.root)
  const files = await collectFiles(path.join(options.root, 'src'))
  const config = await fs.readFile(path.join(options.root, 'vite.config.ts'))
  const sourceHash = createHash('sha256').update(JSON.stringify(files)).update(config).digest('hex')
  const archives = await Promise.all(Object.entries(candidates).sort(([a], [b]) => a.localeCompare(b)).map(async ([name, specifier]) => {
    const file = specifier.slice(5)
    const bytes = await fs.readFile(file)
    return { name, file: path.basename(file), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  }))
  const archiveHash = createHash('sha256').update(JSON.stringify(archives)).digest('hex')
  const lock = JSON.parse(await fs.readFile(path.join(options.root, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string, integrity?: string }> }
  const installedClosure = Object.entries(lock.packages).filter(([name]) => name).map(([name, pkg]) => ({ location: name, version: pkg.version ?? null, integrity: pkg.integrity ?? null }))
  return { cliPath, sourceHash, archiveHash, archives, installMs, installedClosure }
}
