import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import { randomUUID } from 'node:crypto'
import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { readMachineE2ELeaseSnapshot } from '../../../packages/devtools-runtime/src/lease/machineRecovery'
import { managedRecordPath, writeManagedRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createIsolatedMachineLease } from './machineLease'

afterEach(() => vi.unstubAllEnvs())

it('keeps an inherited parent lease and journal unchanged while using its own storage', async () => {
  const parent = await createIsolatedMachineLease()
  try {
    for (const [key, value] of Object.entries(parent.environment)) {
      vi.stubEnv(key, value)
    }
    const before = await readMachineE2ELeaseSnapshot({ stateDirectory: parent.stateDirectory })
    const fixture = await createIsolatedMachineLease()
    try {
      expect(fixture.stateDirectory).not.toBe(parent.stateDirectory)
      const own = await readMachineE2ELeaseSnapshot({ stateDirectory: fixture.stateDirectory })
      expect(own.owner.token).not.toBe(before.owner.token)
      expect(own.scopes).toEqual([expect.objectContaining({ cleanupKey: fixture.journalPath, ancestors: [] })])
      expect(await readMachineE2ELeaseSnapshot({ stateDirectory: parent.stateDirectory })).toEqual(before)
      for (const [key, value] of Object.entries(parent.environment)) {
        expect(process.env[key]).toBe(value)
      }
    }
    finally {
      await fixture.dispose()
    }
    expect(await readMachineE2ELeaseSnapshot({ stateDirectory: parent.stateDirectory })).toEqual(before)
  }
  finally {
    await parent.dispose()
  }
})

it('preserves its temporary state and journal when an owned child still holds the lease', async () => {
  const fixture = await createIsolatedMachineLease()
  const borrower = await acquireMachineE2ELease({ stateDirectory: fixture.stateDirectory, env: fixture.environment })
  try {
    await expect(fixture.dispose()).rejects.toThrow('child is still running')
    await expect(access(fixture.journalPath)).resolves.toBeUndefined()
    expect((await readMachineE2ELeaseSnapshot({ stateDirectory: fixture.stateDirectory })).borrowers).toHaveLength(1)
  }
  finally {
    await borrower.release()
    await fixture.dispose()
  }
  await expect(access(fixture.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('does not delete an unreleased project record even after the test scopes become idle', async () => {
  const fixture = await createIsolatedMachineLease()
  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const file = managedRecordPath(fixture.journalPath, id)
  // 本条只写入模拟登记，没有启动宿主；清理测试数据不能成为处理真实未知资源的范例。
  await writeManagedRecord({
    schemaVersion: 1,
    id,
    generation: id,
    journalPath: fixture.journalPath,
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    target: { cliPath: 'fixture-cli', appPath: 'fixture-app', profileDir: 'fixture-profile', installationId: 'fixture' } satisfies ResolvedWechatDevtoolsTarget,
    projectPath: path.join(fixture.stateDirectory, 'project'),
    state: 'unconfirmed',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  try {
    await expect(fixture.dispose()).rejects.toThrow('unreleased project records')
    await expect(access(file)).resolves.toBeUndefined()
    const snapshot = await readMachineE2ELeaseSnapshot({ stateDirectory: fixture.stateDirectory })
    expect(snapshot.scopes).toEqual([expect.objectContaining({ completed: false })])
  }
  finally {
    await rm(file)
    await fixture.dispose()
  }
})
