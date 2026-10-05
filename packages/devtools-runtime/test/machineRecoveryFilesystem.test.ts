import { mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { readMachineE2ELeaseSnapshot, recoverMachineE2ELease } from '../src/lease/machineRecovery'
import { machineRecoveryFixture } from './helpers/machineRecovery'

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, writeFile: vi.fn(actual.writeFile) }
})

const roots: string[] = []
afterEach(async () => {
  vi.mocked(writeFile).mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it.each(['file', 'directory'])('preserves unknown lease root %s entries', async (kind) => {
  const { directory, options, expected } = await machineRecoveryFixture(roots)
  const extra = path.join(directory, 'unregistered')
  if (kind === 'file') {
    await writeFile(extra, 'preserve')
  }
  else {
    await mkdir(extra)
  }
  const recoverScope = vi.fn(async () => {})
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope })).rejects.toThrow('unknown or missing lease root entry')
  expect(recoverScope).not.toHaveBeenCalled()
  expect(JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8'))).toEqual(expected.owner)
})

it.each(['owner', 'scope', 'borrower'])('rejects unknown fields in a %s record', async (kind) => {
  const { directory, options, expected, parent, borrower } = await machineRecoveryFixture(roots)
  const file = kind === 'owner'
    ? path.join(directory, 'owner.json')
    : kind === 'scope'
      ? path.join(directory, 'scopes', `${parent}.json`)
      : path.join(directory, 'borrowers', `${borrower.token}.json`)
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
  const changed = JSON.stringify({ ...value, unknownEvidence: 'preserve' })
  await writeFile(file, changed)
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('unknown or missing record fields')
  expect(await readFile(file, 'utf8')).toBe(changed)
})

it.each(['lease', 'owner', 'scopes', 'scope', 'borrowers', 'borrower'])('refuses redirected %s entries without modifying their target', async (kind) => {
  const { root, directory, options, expected, parent, borrower } = await machineRecoveryFixture(roots)
  const relative = {
    lease: '',
    owner: 'owner.json',
    scopes: 'scopes',
    scope: path.join('scopes', `${parent}.json`),
    borrowers: 'borrowers',
    borrower: path.join('borrowers', `${borrower.token}.json`),
  }[kind]!
  const file = path.join(directory, relative)
  const target = path.join(root, 'preserved-target')
  const isDirectory = ['lease', 'scopes', 'borrowers'].includes(kind)
  const original = isDirectory ? undefined : await readFile(file, 'utf8')
  await rename(file, target)
  await symlink(target, file, isDirectory ? 'junction' : 'file')
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope: async () => {} })).rejects.toThrow('redirected or non-regular')
  if (!isDirectory) {
    expect(await readFile(target, 'utf8')).toBe(original)
  }
  const ownerFile = kind === 'lease' ? path.join(target, 'owner.json') : path.join(directory, 'owner.json')
  expect(JSON.parse(await readFile(ownerFile, 'utf8'))).toEqual(expected.owner)
})

it('rejects a completed ancestor with unfinished descendants', async () => {
  const { directory, options, parent, expected } = await machineRecoveryFixture(roots, true)
  await writeFile(path.join(directory, 'scopes', `${parent}.json`), JSON.stringify({ owner: expected.owner, ancestors: [], sealed: true, completed: true }))
  await expect(readMachineE2ELeaseSnapshot(options)).rejects.toThrow('unverifiable scope ownership chain')
})

it('retains completed evidence if completion audit persistence prevents release', async () => {
  const { root, directory, options, expected } = await machineRecoveryFixture(roots)
  let auditPath = ''
  await expect(recoverMachineE2ELease({
    ...options,
    expected,
    recoverScope: async (scope) => {
      auditPath = path.join(root, 'machine-e2e-recoveries', `${scope.owner.token}.jsonl`)
      // 用目录替换本测试自己的审计文件，使完成审计失败，不依赖 OS 写权限差异。
      await rename(auditPath, `${auditPath}.evidence`)
      await mkdir(auditPath)
    },
  })).rejects.toThrow()
  expect((await readMachineE2ELeaseSnapshot(options)).owner.pid).toBe(process.pid)
  expect(await readFile(`${auditPath}.evidence`, 'utf8')).toContain('adopting')
  expect(JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8'))).toHaveProperty('pid', process.pid)
})

it('preserves the original audit and old owner when adoption fails between scope writes', async () => {
  const { root, directory, options, expected } = await machineRecoveryFixture(roots, true)
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  const failure = new Error('isolated scope write failed')
  const failFile = path.join(directory, 'scopes', `${expected.scopes[1]!.id}.json`)
  vi.mocked(writeFile).mockImplementation(async (...args) => {
    if (args[0] === failFile) {
      throw failure
    }
    return actual.writeFile(...args)
  })
  const recoverScope = vi.fn(async () => {})
  await expect(recoverMachineE2ELease({ ...options, expected, recoverScope })).rejects.toBe(failure)
  expect(recoverScope).not.toHaveBeenCalled()
  expect(JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8'))).toEqual(expected.owner)
  await expect(readMachineE2ELeaseSnapshot(options)).rejects.toThrow('unverifiable scope ownership chain')
  const audits = await actual.readdir(path.join(root, 'machine-e2e-recoveries'))
  const audit = JSON.parse((await readFile(path.join(root, 'machine-e2e-recoveries', audits[0]!), 'utf8')).trim()) as Record<string, unknown>
  expect(audit).toMatchObject({ event: 'adopting', expected })
})
