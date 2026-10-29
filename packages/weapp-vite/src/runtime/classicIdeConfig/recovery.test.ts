import type { ClassicLease } from './journal'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fsNative from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { installIdeAssetWatch } from '../statefulHmr/assetWatch'
import { ClassicIdeConfigOwner } from './index'
import { readClassicLease, writeClassicLease } from './journal'
import { classicIdeConfigLeasePath } from './leases'

const cleanup: Array<() => Promise<unknown>> = []
const ownerUrl = new URL('./index.ts', import.meta.url).href

afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of cleanup.splice(0).reverse()) {
    await close().catch(() => {})
  }
})

async function fixture(original = '{"setting":{"compileHotReLoad":true}}\r\n') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-lease-recovery-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  await fs.writeFile(file, original)
  const owner = new ClassicIdeConfigOwner()
  cleanup.push(() => owner.close())
  return { root, file, original, owner, journal: classicIdeConfigLeasePath(file) }
}

async function deadLease(file: string, original: string | null) {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await once(child, 'exit')
  const installed = JSON.stringify({ ...JSON.parse(original ?? '{}'), setting: { ...JSON.parse(original ?? '{}').setting, compileHotReLoad: false } })
  const saved: ClassicLease = { schemaVersion: 1, pid: child.pid!, owner: 'retired-owner', original, installed }
  await writeClassicLease(file, saved, true)
  await fs.writeFile(file, installed)
  return saved
}

it('recovers a real process killed after acquisition and preserves the requested view before any write', async () => {
  const { file, original, owner, journal } = await fixture()
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerUrl)}
    const owner = new ClassicIdeConfigOwner()
    await owner.activate(${JSON.stringify(file)})
    process.send('ready')
    process.stdin.resume()
  `], { stdio: ['pipe', 'ignore', 'pipe', 'ipc'] })
  const exited = once(child, 'exit')
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await exited
  })
  let stderr = ''
  child.stderr!.on('data', chunk => stderr += String(chunk))
  const ready = await Promise.race([once(child, 'message'), exited.then(() => {
    throw new Error(stderr)
  })])
  expect(ready[0]).toBe('ready')
  child.kill('SIGKILL')
  await exited
  const installed = await fs.readFile(file, 'utf8')
  const abandoned = await fs.readFile(journal, 'utf8')
  expect(await owner.readRequested(file)).toBe(original)
  expect(await fs.readFile(file, 'utf8')).toBe(installed)
  expect(await fs.readFile(journal, 'utf8')).toBe(abandoned)
  await owner.activate(file)
  expect(await readClassicLease(file)).toMatchObject({ schemaVersion: 1, pid: process.pid, original })
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.pathExists(journal)).toBe(false)
}, 15_000)

it('recovers again when a restoring process is killed after config restoration but before journal deletion', async () => {
  const { file, original, owner, journal } = await fixture()
  await deadLease(file, original)
  const abandoned = await fs.readFile(journal, 'utf8')
  const guard = `${journal}.lock`
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import { fs } from '@weapp-core/shared/fs'
    import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerUrl)}
    const remove = fs.remove.bind(fs)
    fs.remove = async target => {
      if (target === ${JSON.stringify(journal)}) {
        if (await fs.readFile(${JSON.stringify(file)}, 'utf8') !== ${JSON.stringify(original)}) {
          throw new Error('Configuration was not restored before journal deletion')
        }
        process.send('restored-before-journal-removal')
        await new Promise(() => {})
      }
      return remove(target)
    }
    const owner = new ClassicIdeConfigOwner()
    await owner.reconcileStale(${JSON.stringify(file)})
    throw new Error('Journal removal interception was not reached')
  `], { cwd: path.resolve(import.meta.dirname, '../../..'), stdio: ['pipe', 'ignore', 'pipe', 'ipc'] })
  const exited = once(child, 'exit')
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await exited
  })
  let stderr = ''
  child.stderr!.on('data', chunk => stderr += String(chunk))
  const ready = await Promise.race([once(child, 'message'), exited.then(() => {
    throw new Error(stderr)
  })])
  expect(ready[0]).toBe('restored-before-journal-removal')
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.readFile(journal, 'utf8')).toBe(abandoned)
  const tokens = await fs.readdir(guard)
  expect(tokens).toHaveLength(1)
  expect(await fs.readJSON(path.join(guard, tokens[0]!))).toMatchObject({ pid: child.pid })
  child.kill('SIGKILL')
  await exited
  await owner.activate(file)
  expect(await owner.readRequested(file)).toBe(original)
  expect(await readClassicLease(file)).toMatchObject({ pid: process.pid, original })
  expect(await fs.pathExists(guard)).toBe(false)
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.pathExists(journal)).toBe(false)
  expect(await fs.pathExists(guard)).toBe(false)
}, 15_000)

it('allows exactly one new owner to recover a dead journal under concurrent acquisition', async () => {
  const { file, original, owner } = await fixture()
  await deadLease(file, original)
  const other = new ClassicIdeConfigOwner()
  cleanup.push(() => other.close())
  const results = await Promise.allSettled([owner.activate(file), other.activate(file)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const winner = results[0]!.status === 'fulfilled' ? owner : other
  const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
  expect(failure.reason).toMatchObject({ code: 'EEXIST', message: expect.stringContaining('持有') })
  expect(await winner.readRequested(file)).toBe(original)
  await winner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it.each(['EPERM', 'EACCES', 'UNKNOWN'])('preserves a lease when process liveness cannot be disproved: %s', async (code) => {
  const { file, original, owner, journal } = await fixture()
  await deadLease(file, original)
  const before = await fs.readFile(journal, 'utf8')
  const current = await fs.readFile(file, 'utf8')
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('inspection failed'), { code })
  })
  const failure = await owner.activate(file).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 'EEXIST', message: expect.stringContaining('IDE classic') })
  expect(await fs.readFile(journal, 'utf8')).toBe(before)
  expect(await fs.readFile(file, 'utf8')).toBe(current)
  await expect(owner.close()).rejects.toBe(failure)
})

it('keeps user edits, permissions, and CRLF when recovering only the temporary flag', async () => {
  const { file, original, owner } = await fixture()
  await deadLease(file, original)
  const current = '{\r\n\t"setting": {"compileHotReLoad":false,"urlCheck":false},\r\n\t"description":"user"\r\n}\r\n'
  await fs.writeFile(file, current)
  await fsNative.chmod(file, 0o600)
  const mode = (await fs.stat(file)).mode & 0o777
  await owner.activate(file)
  await owner.close()
  expect(await fs.readJSON(file)).toEqual({ setting: { compileHotReLoad: true, urlCheck: false }, description: 'user' })
  expect((await fs.readFile(file, 'utf8')).replaceAll('\r\n', '')).not.toContain('\n')
  expect((await fs.stat(file)).mode & 0o777).toBe(mode)
})

it.each(['deleted', 'edited', 'absent'] as const)('preserves %s user configuration across crash recovery', async (mode) => {
  const { file, original, owner } = await fixture()
  await deadLease(file, mode === 'absent' ? null : original)
  if (mode === 'deleted') {
    await fs.remove(file)
  }
  if (mode === 'edited') {
    await fs.writeFile(file, '{"setting":{"compileHotReLoad":true},"user":true}')
  }
  await owner.activate(file)
  await owner.close()
  if (mode === 'edited') {
    expect(await fs.readJSON(file)).toEqual({ setting: { compileHotReLoad: true }, user: true })
  }
  else {
    expect(await fs.pathExists(file)).toBe(false)
  }
})

it('can retry recovery after restoration succeeds but journal deletion fails', async () => {
  const { file, original, owner, journal } = await fixture()
  await deadLease(file, original)
  const failure = new Error('journal cleanup interrupted')
  const remove = fs.remove.bind(fs)
  const failing = vi.spyOn(fs, 'remove').mockImplementation(async (target) => {
    if (target === journal) {
      throw failure
    }
    await remove(target)
  })
  await expect(owner.reconcileStale(file)).rejects.toBe(failure)
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.pathExists(journal)).toBe(true)
  failing.mockRestore()
  const next = new ClassicIdeConfigOwner()
  cleanup.push(() => next.close())
  await next.activate(file)
  await next.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  await expect(owner.close()).rejects.toBe(failure)
})

it('tracks a published journal even when temporary-file cleanup fails', async () => {
  const { file, original, owner, journal } = await fixture()
  const failure = new Error('temporary cleanup failed')
  const remove = fs.remove.bind(fs)
  const failing = vi.spyOn(fs, 'remove').mockImplementation(async (target) => {
    if (String(target).startsWith(`${journal}.`) && String(target).endsWith('.tmp')) {
      throw failure
    }
    await remove(target)
  })
  await expect(owner.activate(file)).rejects.toBe(failure)
  expect(await readClassicLease(file)).toMatchObject({ pid: process.pid })
  failing.mockRestore()
  await expect(owner.close()).rejects.toBe(failure)
  expect(await fs.pathExists(journal)).toBe(false)
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('preserves the symlink itself while installing and restoring its real target', async () => {
  const { root, file, original, owner } = await fixture()
  const target = path.join(root, 'actual-private.json')
  await fsNative.rename(file, target)
  await fsNative.symlink(target, file)
  await owner.activate(file)
  expect((await fsNative.lstat(file)).isSymbolicLink()).toBe(true)
  expect((await fs.readJSON(target) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  await owner.close()
  expect((await fsNative.lstat(file)).isSymbolicLink()).toBe(true)
  expect(await fs.readFile(target, 'utf8')).toBe(original)
})

it('recovers a dead classic lease during an authorized asset handoff without losing asset ownership', async () => {
  const { root, file, original, owner } = await fixture()
  const restore = await installIdeAssetWatch({ configPath: file, outDir: path.join(root, 'dist') })
  cleanup.push(restore)
  const assetInstalled = await fs.readFile(file, 'utf8')
  await deadLease(file, assetInstalled)
  await restore(owner)
  expect(owner.hasPendingAssetHandoff(file)).toBe(true)
  await owner.activatePendingAssetHandoff(file, path.join(root, 'dist'))
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})
