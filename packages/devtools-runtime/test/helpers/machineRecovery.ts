import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { readMachineE2ELeaseSnapshot } from '../../src/lease/machineRecovery'

export async function machineRecoveryFixture(roots: string[], nested = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'machine-recovery-'))
  roots.push(root)
  const exited = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  await once(exited, 'exit')
  const owner = { pid: exited.pid!, token: randomUUID() }
  const parent = randomUUID()
  const child = randomUUID()
  const completed = randomUUID()
  const borrower = { pid: exited.pid!, token: randomUUID(), scopes: [parent] }
  const directory = path.join(root, 'machine-e2e')
  const scopes = [
    { id: parent, owner, ancestors: [] as string[], sealed: true, completed: false },
    ...(nested
      ? [
          { id: child, owner, ancestors: [parent], sealed: true, completed: false },
          { id: completed, owner, ancestors: [] as string[], sealed: true, completed: true },
        ]
      : []),
  ]
  await mkdir(path.join(directory, 'scopes'), { recursive: true })
  await mkdir(path.join(directory, 'borrowers'))
  await writeFile(path.join(directory, 'owner.json'), JSON.stringify(owner))
  await writeFile(path.join(directory, 'borrowers', `${borrower.token}.json`), JSON.stringify(borrower))
  for (const { id, ...scope } of scopes) {
    await writeFile(path.join(directory, 'scopes', `${id}.json`), JSON.stringify(scope))
  }
  const options = { stateDirectory: root, env: {} as NodeJS.ProcessEnv }
  const expected = await readMachineE2ELeaseSnapshot(options)
  return { root, directory, options, expected, parent, child, borrower }
}
