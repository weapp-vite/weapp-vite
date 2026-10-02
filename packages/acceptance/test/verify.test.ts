import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { configSchema, projectFingerprint } from '@weapp-agent/core'
import { expect, it } from 'vitest'
import { verifyProject } from '../src/verify.js'

const processTreeFixture = `
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = process.argv[2]
if (process.argv[3] === 'child') {
  setInterval(() => {
    if (existsSync(path.join(root, 'stop')))
      process.exit(0)
  }, 25)
  setTimeout(() => process.exit(1), 60_000)
  writeFileSync(path.join(root, 'ready'), 'ready')
}
else {
  process.on('SIGTERM', () => {})
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), root, 'child'], { stdio: 'ignore' })
  writeFileSync(path.join(root, 'pids.json'), JSON.stringify({ parent: process.pid, child: child.pid }))
  child.on('exit', () => process.exit(0))
  child.on('error', () => process.exit(1))
  setTimeout(() => child.kill(), 60_000)
}
`

interface ProcessTree {
  parent: number
  child: number
}

async function readProcessTree(root: string): Promise<ProcessTree> {
  const value: unknown = JSON.parse(await readFile(path.join(root, 'pids.json'), 'utf8'))
  if (
    typeof value !== 'object' || value === null
    || !('parent' in value) || !('child' in value)
    || typeof value.parent !== 'number' || !Number.isSafeInteger(value.parent) || value.parent <= 0
    || typeof value.child !== 'number' || !Number.isSafeInteger(value.child) || value.child <= 0
  ) {
    throw new Error('The process fixture did not record valid owned process IDs.')
  }
  return { parent: value.parent, child: value.child }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return false
    }
    throw error
  }
}

async function expectProcessTreeStopped(tree: ProcessTree): Promise<void> {
  await expect.poll(() => [isRunning(tree.parent), isRunning(tree.child)], {
    timeout: 5000,
  }).toEqual([false, false])
}

async function startVerification(timeoutMs: number) {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-verification-'))
  const controller = new AbortController()
  try {
    const fixture = path.join(root, 'processTree.mjs')
    await writeFile(fixture, processTreeFixture)
    const config = configSchema.parse({
      model: { provider: 'openai', name: 'test' },
      verification: [
        { kind: 'build', command: process.execPath, args: [fixture, root], timeoutMs },
        {
          kind: 'test',
          command: process.execPath,
          args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "ran")', path.join(root, 'next')],
        },
      ],
    })
    const fingerprint = await projectFingerprint(root, config)
    const verification = verifyProject(config, {
      root,
      trusted: true,
      signal: controller.signal,
      approve: async () => false,
    }, fingerprint)
    const settled = verification.then(
      report => ({ report }),
      (error: unknown) => ({ error }),
    )
    return {
      root,
      controller,
      settled,
      async ready() {
        await expect.poll(() => existsSync(path.join(root, 'ready')), { timeout: 5000 }).toBe(true)
        return readProcessTree(root)
      },
      async close() {
        // 先通知本测试拥有的后代退出，即使断言失败也不会遗留进程。
        await writeFile(path.join(root, 'stop'), 'stop')
        controller.abort()
        await settled
        if (existsSync(path.join(root, 'pids.json'))) {
          await expectProcessTreeStopped(await readProcessTree(root))
        }
        await rm(root, { recursive: true, force: true })
      },
    }
  }
  catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

it('cancels the command and its descendants without starting later checks', async () => {
  const run = await startVerification(15_000)
  try {
    const tree = await run.ready()
    const reason = new Error('The caller cancelled verification.')
    run.controller.abort(reason)
    expect(await run.settled).toEqual({ error: reason })
    await expectProcessTreeStopped(tree)
    expect(existsSync(path.join(run.root, 'next'))).toBe(false)
  }
  finally {
    await run.close()
  }
}, 20_000)

it('reports a timeout as failed and terminates the command descendants', async () => {
  const run = await startVerification(5000)
  try {
    const tree = await run.ready()
    const result = await run.settled
    if (!('report' in result)) {
      throw result.error
    }
    const check = result.report.checks.find(item => item.kind === 'build')
    expect(check).toMatchObject({ status: 'failed', timedOut: true })
    expect(check?.output).toContain('Verification command timed out after 5000ms.')
    expect(result.report.passed).toBe(false)
    // Unix 中父进程等待后代退出后以 0 退出，超时仍须判为失败。
    if (process.platform !== 'win32') {
      expect(check?.exitCode).toBe(0)
    }
    await expectProcessTreeStopped(tree)
  }
  finally {
    await run.close()
  }
}, 20_000)
