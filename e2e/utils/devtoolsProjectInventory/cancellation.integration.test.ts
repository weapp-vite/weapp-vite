/* eslint-disable e18e/ban-dependencies -- 该回归需要实际 Node 子进程和 execa 的进程组终止。 */
import type { IsolatedMachineLease } from '../testSupport/machineLease'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { waitForOwnedCommand } from '../../scripts/ownedE2ECommand/shutdown'
import { createIsolatedMachineLease } from '../testSupport/machineLease'
import { clearStoppedScannerEvidence } from './diskFixture'
import { withInventoryCommandScope } from './ownership'

let machine: IsolatedMachineLease
let root: string

beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  root = path.join(machine.stateDirectory, 'inventory-cancellation')
})
afterEach(async () => {
  await clearStoppedScannerEvidence(machine, root)
  await machine.dispose()
})

describe('inventory scanner cancellation with a real child', () => {
  it('confirms the owned child has stopped before completing its machine scope', async () => {
    const cancellation = new AbortController()
    await withInventoryCommandScope({ rootDirectory: root, nonce: randomUUID(), entry: import.meta.filename }, async (ownership) => {
      const child = execa(process.execPath, ['-e', 'setInterval(() => {}, 100000)'], {
        env: ownership.environment,
        stdio: 'ignore',
        reject: false,
        killDescendants: true,
        killSignal: 'SIGKILL',
        forceKillAfterDelay: false,
      })
      await ownership.recordChild(child)
      const waiting = waitForOwnedCommand(child, cancellation.signal)
      cancellation.abort(new Error('scanner deadline'))
      const result = await waiting
      expect(result.signal ?? result.exitCode).toBeTruthy()
      ownership.confirmStopped()
    }, { stateDirectory: machine.stateDirectory, env: { ...machine.environment } })
  }, 30_000)
})
