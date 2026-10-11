import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { acquireMachineE2ELease } from '../../src/lease/machine'

export interface DescendantReady {
  ready: boolean
  childKey: string
  grandchildKey: string
  childEnvironment: NodeJS.ProcessEnv
  grandchildEnvironment: NodeJS.ProcessEnv
  error?: string
}

export async function stoppedDescendantFixture(roots: string[], children: ChildProcess[], legacy = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'stopped-descendants-'))
  roots.push(root)
  const stateDirectory = path.join(root, 'state')
  const resource = path.join(root, 'journal')
  await mkdir(resource)
  const lease = await acquireMachineE2ELease({ stateDirectory, env: {} })
  const scope = await lease.createChildScope({ cleanupKey: resource })
  const child = spawn(process.execPath, [
    '--import',
    import.meta.resolve('tsx'),
    fileURLToPath(new URL('../fixtures/stoppedDescendantChild.ts', import.meta.url)),
    stateDirectory,
    resource,
    ...(legacy ? ['legacy'] : []),
  ], { env: { ...process.env, ...scope.environment }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  children.push(child)
  const [message] = await once(child, 'message') as [DescendantReady]
  if (!message.ready) {
    throw new Error(message.error ?? 'Descendant process exited before registering its resources.')
  }
  return { root, resource, stateDirectory, lease, scope, child, message }
}

export async function killDescendantFixture(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGKILL')
    await exited
  }
}
