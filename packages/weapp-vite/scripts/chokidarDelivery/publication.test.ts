import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, it, vi } from 'vitest'
import { createPublicationObserver, mutateAndAssertOutputs } from './probe/publication.mjs'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_
    reject = reject_
  })
  return { promise, resolve, reject }
}

const outDir = path.resolve('publication-output')
const artifact = { miniprogramRootPath: outDir }
const marker = 'reborn/marker.txt'

function harness() {
  let output: string | null = 'before'
  const read = vi.fn(async (_file: string, expected: string | null) => output === expected)
  const publications = createPublicationObserver(outDir, read)
  return {
    read,
    publications,
    owner: { kind: 'artifact', outDir, publications },
    write(value: string | null) { output = value },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

it('字节提前可见不能开始下一次变更，必须等对应完整发布回调', async () => {
  const ctx = harness()
  const changed = deferred()
  const deleted = deferred()
  const calls: string[] = []
  const workflow = (async () => {
    await mutateAndAssertOutputs([ctx.owner], marker, 'changed', async () => {
      calls.push('change')
      ctx.write('changed')
      changed.resolve()
    }, 'change')
    await mutateAndAssertOutputs([ctx.owner], marker, null, async () => {
      calls.push('delete')
      ctx.write(null)
      deleted.resolve()
    }, 'delete')
  })()
  await changed.promise
  assert.deepEqual(calls, ['change'])
  assert.equal(ctx.read.mock.calls.length, 0)
  await ctx.publications.onRebuilt(artifact)
  await deleted.promise
  assert.deepEqual(calls, ['change', 'delete'])
  await ctx.publications.onRebuilt(artifact)
  await workflow
  assert.deepEqual(ctx.read.mock.calls.map(([, expected]) => expected), ['changed', null])
})

it('变更返回前同步到达的自然发布回调不会因事后登记而丢失', async () => {
  const ctx = harness()
  await mutateAndAssertOutputs([ctx.owner], marker, 'created', async () => {
    ctx.write('created')
    await ctx.publications.onRebuilt(artifact)
  }, 'create')
  assert.equal(ctx.read.mock.calls.length, 1)
})

it('ticket 之前的回调和错误输出不能与之后的正确字节拼成通过', async () => {
  const ctx = harness()
  await ctx.publications.onRebuilt(artifact)
  const ticket = ctx.publications.expectOutput(marker, 'changed')
  let completed = false
  ticket.completed.then(() => {
    completed = true
  })
  await ctx.publications.onRebuilt(artifact)
  assert.equal(completed, false)
  ctx.write('changed')
  await Promise.resolve()
  assert.equal(completed, false)
  await ctx.publications.onRebuilt(artifact)
  await ticket.completed
  assert.equal(completed, true)
  ticket.dispose()
})

it('旧回调入口固定 ticket，异步读取结束后不能完成下一张 ticket', async () => {
  const readStarted = deferred()
  const oldRead = deferred<boolean>()
  let reads = 0
  const read = vi.fn(async () => {
    if (++reads === 1) {
      readStarted.resolve()
      return await oldRead.promise
    }
    return true
  })
  const publications = createPublicationObserver(outDir, read)
  const previous = publications.expectOutput(marker, 'created')
  const oldCallback = publications.onRebuilt(artifact)
  await readStarted.promise
  previous.dispose()
  const next = publications.expectOutput(marker, 'changed')
  let completed = false
  next.completed.then(() => {
    completed = true
  })
  oldRead.resolve(true)
  await oldCallback
  assert.equal(completed, false)
  await publications.onRebuilt(artifact)
  await next.completed
  next.dispose()
})

it('删除必须在新的完整回调现场观察缺失，清空输出的过渡空窗无效', async () => {
  const ctx = harness()
  const ticket = ctx.publications.expectOutput(marker, null)
  let completed = false
  ticket.completed.then(() => {
    completed = true
  })
  await ctx.publications.onRebuilt(artifact)
  ctx.write(null)
  await Promise.resolve()
  assert.equal(completed, false)
  ctx.write('old-output-restored')
  await ctx.publications.onRebuilt(artifact)
  assert.equal(completed, false)
  ctx.write(null)
  await ctx.publications.onRebuilt(artifact)
  await ticket.completed
  ticket.dispose()
})

it('没有发布回调时维持整个阶段四十五秒上限，并记录 phase 与前后序号', async () => {
  vi.useFakeTimers()
  const ctx = harness()
  const changed = deferred()
  const operation = mutateAndAssertOutputs([ctx.owner], marker, null, async () => {
    ctx.write(null)
    changed.resolve()
  }, 'delete')
  const rejected = assert.rejects(operation, /delete public publication;.*expected=null;.*"after":0,"observed":0/)
  await changed.promise
  await vi.advanceTimersByTimeAsync(45_000)
  await rejected
  assert.equal(vi.getTimerCount(), 0)
  ctx.publications.expectOutput(marker, 'next').dispose()
})

it('变更或回调读取失败保留原始错误，并释放本次 ticket', async () => {
  const ctx = harness()
  const original = new Error('mutation failed')
  await assert.rejects(mutateAndAssertOutputs([ctx.owner], marker, null, async () => {
    throw original
  }, 'delete'), error => error === original)
  ctx.publications.expectOutput(marker, 'next').dispose()

  const readFailure = new Error('publication read failed')
  const publications = createPublicationObserver(outDir, async () => {
    throw readFailure
  })
  const started = deferred()
  const operation = mutateAndAssertOutputs([{ kind: 'artifact', outDir, publications }], marker, null, async () => {
    started.resolve()
  }, 'delete')
  const rejected = assert.rejects(operation, error => error === readFailure)
  await started.promise
  await assert.rejects(publications.onRebuilt(artifact), error => error === readFailure)
  await rejected
  publications.expectOutput(marker, 'next').dispose()
})

it('超时后的旧读取错误仍从原回调抛出，不能吞错或拒绝下一张 ticket', async () => {
  vi.useFakeTimers()
  const readStarted = deferred()
  const oldRead = deferred<boolean>()
  let reads = 0
  const publications = createPublicationObserver(outDir, async () => {
    if (++reads === 1) {
      readStarted.resolve()
      return await oldRead.promise
    }
    return true
  })
  const operation = mutateAndAssertOutputs([{ kind: 'artifact', outDir, publications }], marker, null, async () => {}, 'delete')
  const timedOut = assert.rejects(operation, /delete public publication/)
  const callback = publications.onRebuilt(artifact)
  const original = new Error('late publication read failed')
  const callbackRejected = assert.rejects(callback, error => error === original)
  await readStarted.promise
  await vi.advanceTimersByTimeAsync(45_000)
  await timedOut
  const next = publications.expectOutput(marker, 'next')
  let nextRejected = false
  next.completed.catch(() => {
    nextRejected = true
  })
  oldRead.reject(original)
  await callbackRejected
  assert.equal(nextRejected, false)
  await publications.onRebuilt(artifact)
  await next.completed
  next.dispose()
  assert.equal(vi.getTimerCount(), 0)
})

it('真实复制 probe 后普通 Node 可导入 publication helper，不依赖源码或测试 loader', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chokidar-publication-copy-'))
  try {
    await cp(new URL('./probe/', import.meta.url), path.join(root, 'probe'), { recursive: true })
    const helper = pathToFileURL(path.join(root, 'probe', 'publication.mjs')).href
    const source = `
      const { createPublicationObserver, mutateAndAssertOutputs } = await import(process.argv[1])
      const outDir = process.cwd()
      const publications = createPublicationObserver(outDir, async () => true)
      await mutateAndAssertOutputs([{ kind: 'artifact', outDir, publications }], 'marker.txt', null, async () => {
        await publications.onRebuilt({ miniprogramRootPath: outDir })
      }, 'delete')
      console.log('copied-publication-helper-ok')
    `
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', source, helper], { cwd: root, encoding: 'utf8' })
    assert.equal(output.trim(), 'copied-publication-helper-ok')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
