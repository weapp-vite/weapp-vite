import { performance } from 'node:perf_hooks'
import process from 'node:process'

const started = performance.now()
let phase = 'module-import'
let queryStarted: number | undefined
try {
  const { readManagedProcessIdentity } = await import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host')
  phase = 'identity-query'
  queryStarted = performance.now()
  const identity = await readManagedProcessIdentity(Number(process.argv[2]))
  process.stdout.write(JSON.stringify({
    outcome: identity ? 'present' : 'missing',
    elapsedMs: performance.now() - started,
    queryElapsedMs: performance.now() - queryStarted,
    identity: identity && { ProcessId: identity.pid, ExecutablePath: identity.executable, Started: identity.started },
  }))
}
catch (error) {
  process.stdout.write(JSON.stringify({
    outcome: 'error',
    phase,
    elapsedMs: performance.now() - started,
    queryElapsedMs: queryStarted === undefined ? undefined : performance.now() - queryStarted,
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Non-Error thrown',
  }))
  process.exitCode = 1
}
