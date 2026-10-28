/* eslint-disable e18e/ban-dependencies -- 本地 Git fixture 验证真实补丁准备过程。 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, describe, expect, it, onTestFailed, vi } from 'vitest'
import { upstreamCommit } from '../config'
import { preparationInputs, preparedRoot } from './preparation'
import { recordPreparedAssets, requiredAssets } from './preparedAssets'
import { prepareInstallation } from './prepareSource'

// 真实 Git 集成用例包含多次进程启动和磁盘操作，为 Windows runner 保留完整执行预算。
const gitIntegrationTimeout = 30_000

const temporary: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})
async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'dimina-preparation-'))
  temporary.push(result)
  return result
}
async function project() {
  const root = await directory()
  await mkdir(path.join(root, 'upstream/patches'), { recursive: true })
  await mkdir(path.join(root, 'scripts'))
  await mkdir(path.join(root, 'upstream/toolchain'))
  for (const file of ['upstream/pnpm-lock.yaml', 'scripts/setup.ts', 'scripts/preparation.ts', 'scripts/portableCache.ts', 'scripts/cacheSnapshot.ts', 'scripts/prepareSource.ts', 'scripts/preparedAssets.ts', 'scripts/upstreamTests.ts', 'scripts/toolchain.ts', 'upstream/toolchain/package.json', 'upstream/toolchain/package-lock.json', 'upstream/toolchain/pnpm-workspace.yaml', 'upstream/patches/components.patch']) {
    await writeFile(path.join(root, file), file)
  }
  return root
}

async function installationFixture() {
  let phase = 'create local Git fixture'
  const setPhase = (next: string) => {
    phase = next
  }
  onTestFailed(() => console.error(`SDK preparation failed during: ${phase}`))
  const source = await directory()
  const cache = await directory()
  const git = (args: string[]) => execa('git', args, { cwd: source })
  setPhase('initialize source Git repository')
  await git(['init'])
  await writeFile(path.join(source, 'value.txt'), 'before\n')
  setPhase('stage source fixture')
  await git(['add', '.'])
  setPhase('commit source fixture')
  await git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'])
  setPhase('read source commit')
  const commit = (await git(['rev-parse', 'HEAD'])).stdout
  await writeFile(path.join(source, 'value.txt'), 'after\n')
  const patch = path.join(cache, 'change.patch')
  setPhase('create source patch')
  await writeFile(patch, `${(await git(['diff'])).stdout}\n`)
  await writeFile(path.join(source, 'value.txt'), 'unknown local edit\n')
  const options = { source, cache, commit, patches: [patch], fingerprint: 'test' }
  const build = async (directory: string) => {
    expect(await readFile(path.join(directory, 'value.txt'), 'utf8')).toBe('after\n')
  }
  const expectReady = async (directory: string) => {
    expect(JSON.parse(await readFile(path.join(cache, 'ready.json'), 'utf8'))).toEqual({ commit, fingerprint: 'test', directory: path.basename(directory) })
  }
  return { source, cache, patch, options, build, expectReady, setPhase }
}

describe('SDK preparation boundary', () => {
  it('rejects absent, malformed, unsafe and stale markers', async () => {
    const root = await project()
    const cache = await directory()
    const { fingerprint } = await preparationInputs(root)
    for (const value of [null, {}, { commit: upstreamCommit, fingerprint, directory: '../source' }, { commit: 'old', fingerprint, directory: 'build-test' }]) {
      await writeFile(path.join(cache, 'ready.json'), JSON.stringify(value))
      await expect(preparedRoot(root, cache)).rejects.toThrow('setup:dimina')
    }
    await writeFile(path.join(cache, 'ready.json'), 'invalid JSON')
    await expect(preparedRoot(root, cache)).rejects.toThrow('setup:dimina')
    await rm(path.join(cache, 'ready.json'))
    await expect(preparedRoot(root, cache)).rejects.toThrow('setup:dimina')
    await writeFile(path.join(cache, 'ready.json'), JSON.stringify({ commit: upstreamCommit, fingerprint, directory: 'build-test' }))
    await expect(preparedRoot(root, cache)).rejects.toThrow('incomplete SDK')
    const build = path.join(cache, 'build-test')
    for (const name of requiredAssets) {
      const file = path.join(build, 'fe/packages', name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, name)
    }
    await mkdir(path.join(build, 'fe/node_modules'), { recursive: true })
    await writeFile(path.join(build, 'fe/node_modules/.modules.yaml'), '')
    await recordPreparedAssets(build)
    expect(await preparedRoot(root, cache)).toBe(build)
    const worker = path.join(build, 'fe/packages/container-sdk/dist/service.js')
    await writeFile(worker, 'corrupted')
    await expect(preparedRoot(root, cache)).rejects.toThrow('incomplete SDK')
    await rm(worker)
    await expect(preparedRoot(root, cache)).rejects.toThrow('incomplete SDK')
    await writeFile(worker, 'container-sdk/dist/service.js')
    expect(await preparedRoot(root, cache)).toBe(build)
    await rm(path.join(build, 'fe/node_modules/.modules.yaml'))
    await expect(preparedRoot(root, cache)).rejects.toThrow('incomplete SDK')
    expect(await preparedRoot(root, cache, { allowMissingDependencies: true })).toBe(build)
    await rm(worker)
    await expect(preparedRoot(root, cache, { allowMissingDependencies: true })).rejects.toThrow('incomplete SDK')
    await writeFile(worker, 'container-sdk/dist/service.js')
    await writeFile(path.join(build, 'fe/node_modules/.modules.yaml'), '')
    expect(await preparedRoot(root, cache)).toBe(build)
    await writeFile(path.join(root, 'upstream/patches/components.patch'), 'changed')
    await expect(preparedRoot(root, cache)).rejects.toThrow('stale SDK')
  })

  it.each(['upstream/pnpm-lock.yaml', 'scripts/setup.ts', 'scripts/preparation.ts', 'scripts/portableCache.ts', 'scripts/cacheSnapshot.ts', 'scripts/prepareSource.ts', 'scripts/preparedAssets.ts', 'scripts/upstreamTests.ts', 'scripts/toolchain.ts', 'upstream/toolchain/package.json', 'upstream/toolchain/package-lock.json', 'upstream/toolchain/pnpm-workspace.yaml', 'upstream/patches/components.patch'])('invalidates preparation when %s changes', async (file) => {
    const root = await project()
    const first = await preparationInputs(root)
    expect(await preparationInputs(root)).toEqual(first)
    await writeFile(path.join(root, file), 'changed')
    expect((await preparationInputs(root)).fingerprint).not.toBe(first.fingerprint)
  })

  it('applies a CRLF patch with LF index/worktree semantics under Windows Git defaults', { timeout: gitIntegrationTimeout }, async () => {
    const source = await directory()
    const cache = await directory()
    const git = (args: string[]) => execa('git', args, { cwd: source })
    await git(['init'])
    await git(['config', 'core.autocrlf', 'false'])
    await writeFile(path.join(source, 'component.js'), 'before\n')
    await git(['add', '.'])
    await git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'])
    const commit = (await git(['rev-parse', 'HEAD'])).stdout
    await writeFile(path.join(source, 'component.js'), 'after\n')
    const patch = path.join(cache, 'component.patch')
    await writeFile(patch, `${(await git(['diff'])).stdout}\n`.replace(/\n/g, '\r\n'))
    const config = path.join(cache, 'gitconfig')
    await writeFile(config, '[core]\n  autocrlf = true\n')
    vi.stubEnv('GIT_CONFIG_GLOBAL', config)
    await prepareInstallation({ source, cache, commit, patches: [patch], fingerprint: 'test' }, async (build) => {
      expect(await readFile(path.join(build, 'component.js'), 'utf8')).toBe('after\n')
      const staged = await execa('git', ['show', ':component.js'], { cwd: build, stripFinalNewline: false })
      expect(staged.stdout).toBe('after\n')
    })
  })

  it('prepares clean isolated builds repeatedly without changing local edits', { timeout: gitIntegrationTimeout }, async () => {
    const { source, options, build, expectReady, setPhase } = await installationFixture()
    setPhase('prepare first isolated build')
    const first = await prepareInstallation(options, build)
    await writeFile(path.join(first, 'value.txt'), 'previous build local edit\n')
    setPhase('prepare second isolated build')
    const second = await prepareInstallation(options, build)
    expect(second).not.toBe(first)
    expect(await readFile(path.join(source, 'value.txt'), 'utf8')).toBe('unknown local edit\n')
    expect(await readFile(path.join(first, 'value.txt'), 'utf8')).toBe('previous build local edit\n')
    await expectReady(second)
  })

  it('clears a previous ready marker after a build failure and recovers', { timeout: gitIntegrationTimeout }, async () => {
    const { cache, options, build, expectReady, setPhase } = await installationFixture()
    setPhase('prepare successful build before build failure')
    const first = await prepareInstallation(options, build)
    await expectReady(first)
    setPhase('prepare failing build')
    await expect(prepareInstallation(options, async () => {
      throw new Error('failed build')
    })).rejects.toThrow('failed build')
    await expect(readFile(path.join(cache, 'ready.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    setPhase('recover after build failure')
    const recovered = await prepareInstallation(options, build)
    await expectReady(recovered)
  })

  it('clears a previous ready marker after a patch failure and recovers', { timeout: gitIntegrationTimeout }, async () => {
    const { cache, patch, options, build, expectReady, setPhase } = await installationFixture()
    setPhase('prepare successful build before patch failure')
    const first = await prepareInstallation(options, build)
    await expectReady(first)
    const goodPatch = await readFile(patch)
    await writeFile(patch, 'invalid patch')
    setPhase('reject invalid patch')
    await expect(prepareInstallation(options, build)).rejects.toThrow()
    await expect(readFile(path.join(cache, 'ready.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await writeFile(patch, goodPatch)
    setPhase('recover after patch failure')
    const recovered = await prepareInstallation(options, build)
    await expectReady(recovered)
  })
})
