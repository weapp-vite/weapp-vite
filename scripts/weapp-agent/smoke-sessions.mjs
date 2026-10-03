import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- Keep installed CLI checks consistent across operating systems.
import { execa } from 'execa'

/** 从实际安装包验证只读会话命令，不调用模型或执行恢复操作。 */
export async function smokeSessions(cli, project, env) {
  const root = await realpath(project)
  const directory = path.join(env.WEAPP_AGENT_STATE_DIR, 'sessions', createHash('sha256').update(root).digest('hex'))
  await mkdir(directory, { recursive: true })
  const sessionId = 'installed-session'
  const image = 'cHJpdmF0ZS1pbWFnZQ=='
  const events = [
    ['run.started', { model: 'fixture' }],
    ['message', { message: { role: 'user', origin: 'user', text: 'Preserve the counter task', images: [{ type: 'image', data: image, mediaType: 'image/png' }] } }],
    ['message', { message: { role: 'assistant', text: '', calls: [{ id: 'reused', name: 'read_file', input: { path: 'page.ts' } }] } }],
    ['message', { message: { role: 'tool', callId: 'reused', name: 'read_file', result: { text: 'old result' } } }],
    ['step.started', { step: 1 }],
    ['usage', { inputTokens: 10, outputTokens: 5 }],
    ['message', { message: { role: 'assistant', text: '', calls: [
      { id: 'reused', name: 'edit_file', input: { path: 'page.ts' } },
      { id: 'queued', name: 'read_file', input: { path: 'other.ts' } },
    ] } }],
    ['tool.started', { callId: 'reused', name: 'edit_file', mutates: true }],
  ].map(([type, data], index) => ({ version: 1, sessionId, sequence: index + 1, timestamp: new Date(index * 1000).toISOString(), type, data }))
  const filename = path.join(directory, `${sessionId}.jsonl`)
  const original = `${events.map(event => JSON.stringify(event)).join('\n')}\n{"partial"`
  await writeFile(filename, original)
  await writeFile(path.join(directory, 'damaged.jsonl'), '{broken}\n')
  const run = async (args) => {
    const result = await execa(process.execPath, [cli, '-C', root, ...args, '--json'], { env, reject: false, timeout: 30_000 })
    return { ...result, data: JSON.parse(result.stdout) }
  }
  const legacy = await run(['sessions'])
  assert.equal(legacy.exitCode, 0)
  assert.deepEqual(legacy.data.sort(), ['damaged', sessionId].sort())
  const details = await run(['session', sessionId])
  assert.equal(details.exitCode, 0)
  assert.equal(details.data.status, 'unfinished')
  assert.equal(details.data.prompt, 'Preserve the counter task')
  assert.equal(details.data.steps, 1)
  assert.deepEqual(details.data.usage, { inputTokens: 10, outputTokens: 5 })
  assert.deepEqual(details.data.pendingCalls.map(call => [call.id, call.state]), [['reused', 'outcome_unknown'], ['queued', 'not_executed']])
  assert(details.data.diagnostics.length > 0)
  assert(!details.stdout.includes(image))
  const summaries = await run(['sessions', '--details'])
  assert.equal(summaries.exitCode, 0)
  assert.equal(summaries.data.length, 2)
  assert.equal(summaries.data.find(item => item.sessionId === 'damaged').status, 'invalid')
  assert.equal((await run(['session', 'damaged'])).exitCode, 1)
  assert.equal(await readFile(filename, 'utf8'), original)
  assert(!(await readdir(directory)).some(file => file.endsWith('.lock')))
}
