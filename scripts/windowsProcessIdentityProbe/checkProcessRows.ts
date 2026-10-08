import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { captureDevProcessTree, readDevProcessIdentities } from '../../e2e/utils/devProcessCleanup/processes'
import { runWithCleanup } from '../../e2e/utils/runWithCleanup'
import { readManagedProcessIdentity, sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'

assert.equal(process.platform, 'win32')
assert.equal(process.env.WEAPP_VITE_E2E_CLEANUP_TRACE, '1')
assert.equal(process.env.WEAPP_VITE_E2E_CLEANUP_QUERY_TRANSPORT, 'rows')

const root = await mkdtemp(path.join(tmpdir(), 'process-rows-'))
const fixture = path.join(root, 'tree.cjs')
const executable = path.join(root, '节点 with space.exe')
const children: ReturnType<typeof fork>[] = []
const source = `
const { fork } = require('node:child_process');
const nested = process.argv[2] === 'tree' ? fork(__filename, ['leaf'], { execPath: process.execPath, execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }) : undefined;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (!nested) return process.exit(0);
  nested.once('exit', code => process.exit(code === 0 ? 0 : 1));
  nested.send('stop');
}
process.on('message', stop);
process.on('disconnect', stop);
if (nested) nested.once('message', message => process.send([process.pid, ...message]));
else process.send([process.pid]);
`

async function launch(mode: string) {
  const child = fork(fixture, [mode], { execPath: executable, execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'], windowsHide: true })
  children.push(child)
  const [pids] = await once(child, 'message', { signal: AbortSignal.timeout(5_000) })
  assert.ok(Array.isArray(pids) && pids.every(Number.isSafeInteger))
  return { child, pids: pids as number[] }
}

async function close(child: ReturnType<typeof fork>) {
  if (child.exitCode !== null || child.signalCode !== null) {
    assert.equal(child.exitCode, 0)
    assert.equal(child.signalCode, null)
    return
  }
  const exited = once(child, 'exit', { signal: AbortSignal.timeout(5_000) })
  child.send('stop')
  const [code, signal] = await exited
  assert.equal(code, 0)
  assert.equal(signal, null)
}

await runWithCleanup(async () => {
  await copyFile(process.execPath, executable)
  await writeFile(fixture, source)
  const owned = await launch('tree')
  const unrelated = await launch('leaf')
  // 首次 PowerShell 查询直接走候选；对照读取在之后，不预热冷查询。
  const started = performance.now()
  const identities = await captureDevProcessTree(owned.child.pid!, () => owned.child.exitCode === null && owned.child.signalCode === null)
  const firstSnapshotMs = performance.now() - started
  assert.deepEqual(identities.map(value => value.pid).sort(), [...owned.pids].sort())
  assert.equal(identities.some(value => value.pid === unrelated.child.pid), false)
  for (const identity of identities) {
    assert.equal(identity.executable, executable)
    const original = await readManagedProcessIdentity(identity.pid)
    assert.ok(original)
    assert.equal(sameManagedProcess(identity, original), true)
    assert.equal(sameManagedProcess(original, identity), true)
  }
  const current = await readDevProcessIdentities(owned.pids)
  for (const identity of identities) {
    assert.deepEqual(current.get(identity.pid), identity)
  }
  await close(owned.child)
  const exited = await readDevProcessIdentities(owned.pids)
  assert.ok([...exited.values()].every(value => value === undefined))
  assert.equal(unrelated.child.exitCode, null)
  assert.equal(unrelated.child.signalCode, null)
  console.info(JSON.stringify({ status: 'passed', queryBudgetMs: 10_000, firstSnapshotMs, exactLegacyIdentity: true, processCount: identities.length, unrelatedPreserved: true, exitedMissing: true }))
}, async () => {
  // 只给本脚本直接创建的 IPC 句柄请求正常退出；失败时保留 fixture 和原错。
  const results = await Promise.allSettled(children.map(close))
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (errors.length) {
    throw new AggregateError(errors, 'Owned row fixture cleanup did not complete; temporary directory retained.')
  }
  await rm(root, { recursive: true, force: true })
})
