import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { readManagedProcessIdentity, sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { readManagedJournalWriterIdentity } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/writerIdentity'
import { resolveWechatInspectionTimeout } from '../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'

// 此进程首次主动身份查询必须是生产 writer 自查，不能先用 CIM 或其他 PowerShell 预热。
assert.equal(process.platform, 'win32')
assert.equal(resolveWechatInspectionTimeout('win32'), 10_000)
const startedAt = performance.now()
const pending = readManagedJournalWriterIdentity()
assert.equal(readManagedJournalWriterIdentity(), pending)
const writer = await pending
const firstQueryMs = performance.now() - startedAt
assert.equal(writer.pid, process.pid)
assert.equal(writer.executable, process.execPath)
assert.equal(await readManagedJournalWriterIdentity(), writer)
assert.match(writer.started, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}0Z$/)

// 对照在首次调用之后，验证旧读取器双向精确匹配，不把预热后的 CIM 标记为冷启动。
const legacy = await readManagedProcessIdentity(process.pid)
assert.ok(legacy)
assert.equal(sameManagedProcess(writer, legacy), true)
assert.equal(sameManagedProcess(legacy, writer), true)
process.stdout.write(JSON.stringify({
  status: 'passed',
  node: process.version,
  architecture: process.arch,
  queryBudgetMs: 10_000,
  observation: 'first-writer-query-in-new-node-process',
  firstQueryMs,
  exactLegacyIdentity: true,
  samePromiseDuringFirstQuery: true,
  sameObjectAfterFirstQuery: true,
  executableSha256: createHash('sha256').update(writer.executable).digest('hex'),
  started: writer.started,
  limitations: 'Owned current Node writer only; OS/provider first use, arbitrary hosts, access rights and exit races are not established by this sample.',
}))
