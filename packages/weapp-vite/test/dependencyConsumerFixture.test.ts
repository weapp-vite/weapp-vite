import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 安装回归需要跨平台调用真实包管理器。
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { parsePnpmLockfile } from '../../../scripts/pnpmLockfile/index.mjs'
import { verifyConsumerTarballProvenance } from '../scripts/consumerTarballs.mjs'
import { createDashboardIsolationWorkspace } from '../scripts/dashboardConsumerFixture.mjs'
import { createDependencyConsumerManifest } from '../scripts/dependencyConsumerFixture.mjs'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function archive(root: string, name: string, version: string, fields = {}) {
  const source = path.join(root, name)
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name, version, main: 'index.js', ...fields }))
  await writeFile(path.join(source, 'index.js'), 'module.exports = {}')
  const result = await execa('npm', ['pack', '--ignore-scripts', '--pack-destination', root, '--json'], { cwd: source })
  const packed = JSON.parse(result.stdout) as Array<{ filename: string }>
  return `file:${path.join(root, packed[0]!.filename).replaceAll('\\', '/')}`
}

describe('strict dependency consumer roots', () => {
  it('declares public entry packages and keeps internal candidates in npm overrides', () => {
    const candidates = { 'weapp-vite': 'file:core.tgz', 'wevu': 'file:wevu.tgz', 'vite-plugin-performance': 'file:plugin.tgz' }
    const peers = { tailwindcss: '4.3.3' }
    const manifest = createDependencyConsumerManifest(candidates, peers, 'npm')
    expect(manifest.dependencies).toEqual({ 'weapp-vite': candidates['weapp-vite'], 'wevu': candidates.wevu, 'typescript': '6.0.3' })
    expect(manifest.devDependencies).toEqual(peers)
    expect(manifest.overrides).toEqual({ 'weapp-vite': '$weapp-vite', 'wevu': '$wevu', 'vite-plugin-performance': candidates['vite-plugin-performance'] })
    expect(createDependencyConsumerManifest({ ...candidates, '@weapp-vite/react': 'file:react.tgz' }, peers, 'pnpm').dependencies['@weapp-vite/react']).toBe('file:react.tgz')
    expect(() => createDependencyConsumerManifest({ wevu: candidates.wevu }, peers, 'pnpm')).toThrow('Missing packed entry: weapp-vite')
  })

  it('satisfies an internal mandatory peer from its owner without promoting the plugin or host to root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'strict-consumer-peer-'))
    directories.push(root)
    const host = await archive(root, 'vite', '8.3.5')
    const candidates = {
      'weapp-vite': await archive(root, 'weapp-vite', '7.7.0', { dependencies: { 'vite': host, 'vite-plugin-performance': '2.1.0' } }),
      'wevu': await archive(root, 'wevu', '7.7.0'),
      'vite-plugin-performance': await archive(root, 'vite-plugin-performance', '2.1.0', { peerDependencies: { vite: '8.3.5' } }),
      'typescript': await archive(root, 'typescript', '6.0.3'),
    }
    const install = async (directory: string, manifest: object) => {
      await mkdir(directory)
      await writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest))
      await writeFile(path.join(directory, 'pnpm-workspace.yaml'), stringify(createDashboardIsolationWorkspace(candidates, directory)))
      return execa('pnpm', ['install', '--offline', '--strict-peer-dependencies', '--config.engine-strict=true', '--config.ignore-scripts=false', '--reporter=append-only'], {
        cwd: directory,
        env: { npm_config_legacy_peer_deps: 'false', npm_config_force: 'false' },
        reject: false,
      })
    }
    const promoted = await install(path.join(root, 'promoted'), { private: true, dependencies: candidates })
    expect(promoted.exitCode).not.toBe(0)
    expect(promoted.all ?? `${promoted.stdout}\n${promoted.stderr}`).toContain('missing peer vite')

    const consumer = path.join(root, 'consumer')
    const installed = await install(consumer, createDependencyConsumerManifest(candidates, {}, 'pnpm'))
    expect(installed.exitCode, `${installed.stdout}\n${installed.stderr}`).toBe(0)
    // 独立 Node 进程不经过 Vitest 的工作区解析兜底，不能借到维护仓库的 Vite。
    await execa(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict'
      import { createRequire } from 'node:module'
      import path from 'node:path'
      const consumer = createRequire(path.join(process.cwd(), 'package.json'))
      const owner = createRequire(consumer.resolve('weapp-vite/package.json'))
      const plugin = createRequire(owner.resolve('vite-plugin-performance'))
      const host = owner.resolve('vite')
      assert(host.startsWith(path.join(process.cwd(), 'node_modules') + path.sep))
      assert.equal(plugin.resolve('vite'), host)
      for (const name of ['vite', 'vite-plugin-performance']) {
        assert.throws(() => consumer.resolve(name), { code: 'MODULE_NOT_FOUND' })
      }
    `], { cwd: consumer, env: { NODE_PATH: '' } })
    const lock = parsePnpmLockfile(await readFile(path.join(consumer, 'pnpm-lock.yaml'), 'utf8')) as { packages: Record<string, { resolution: { tarball: string } }> }
    for (const [name, tarball] of Object.entries(candidates)) {
      const matches = Object.entries(lock.packages).filter(([key]) => key.startsWith(`${name}@`))
      expect(matches.length).toBeGreaterThan(0)
      for (const [, entry] of matches) {
        expect(path.resolve(consumer, entry.resolution.tarball.replace(/^file:/, ''))).toBe(path.resolve(tarball.slice(5)))
      }
    }

    // npm 同样只声明公开入口，内部候选仍必须经 overrides 保留归档来源。
    const npmRoot = path.join(root, 'npm-consumer')
    const npmCandidates = Object.fromEntries(Object.entries(candidates).filter(([name]) => name !== 'typescript'))
    const npmManifest = createDependencyConsumerManifest(npmCandidates, {}, 'npm')
    // 此隔离回归只使用本地归档，不从注册表下载 TypeScript。
    npmManifest.dependencies.typescript = candidates.typescript
    await mkdir(npmRoot)
    await writeFile(path.join(npmRoot, 'package.json'), JSON.stringify(npmManifest))
    const npmInstall = await execa('npm', ['install', '--offline', '--strict-peer-deps', '--no-audit', '--no-fund'], {
      cwd: npmRoot,
      env: { npm_config_cache: path.join(root, '.npm-cache'), npm_config_legacy_peer_deps: 'false', npm_config_force: 'false' },
      reject: false,
    })
    expect(npmInstall.exitCode, `${npmInstall.stdout}\n${npmInstall.stderr}`).toBe(0)
    expect(await verifyConsumerTarballProvenance(npmRoot, npmCandidates, ['weapp-vite', 'wevu'])).toBe(Object.keys(npmCandidates).length)
  })
})
