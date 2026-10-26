import type { NativeOutputPublicationSnapshot } from '../../../packages/weapp-vite/src/plugins/outputFinalizer/publicationObservation'
import type { NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import { afterEach, expect, it, vi } from 'vitest'
import { NATIVE_PUBLICATION_PREFIX } from './files'
import { nativePublicationPlugin } from './plugin'

const projects: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

async function fixture(outputRoot = 'dist') {
  const project = await mkdtemp(path.join(tmpdir(), 'committed-observation-'))
  projects.push(project)
  await mkdir(path.join(project, 'src'))
  await writeFile(path.join(project, 'src/app.js'), 'App({})')
  const root = path.join(project, outputRoot)
  const requests = new Map<number, ReturnType<typeof Promise.withResolvers<NativeOutputPublicationSnapshot | undefined>>>()
  let epoch = 0
  let output = ''
  const write = process.stdout.write.bind(process.stdout)
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (write as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const observer = nativePublicationPlugin({ outputRoot })
  const context = { environment: { config: { root: project, build: { outDir: 'dist' }, plugins: [{
    name: WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME,
    api: {
      getEpoch: () => epoch,
      whenCommitted: (requestedRoot: string, requestedEpoch: number) => {
        expect(requestedRoot).toBe(root)
        const request = Promise.withResolvers<NativeOutputPublicationSnapshot | undefined>()
        requests.set(requestedEpoch, request)
        return request.promise
      },
    },
  }] } } }
  const buildStart = observer.buildStart
  const generate = observer.generateBundle
  const writeBundle = observer.writeBundle
  const close = observer.closeBundle
  if (typeof buildStart !== 'function' || typeof generate !== 'function' || typeof writeBundle !== 'object' || typeof close !== 'function') {
    throw new TypeError('Expected native observation lifecycle hooks')
  }
  const render = async (file: string, outputDir = root) => {
    epoch++
    await buildStart.call(context as never, {} as never)
    await generate.call(context as never, {} as never, {} as never, true)
    await writeBundle.handler.call(context as never, { dir: outputDir } as never, {
      [file]: { type: 'asset', fileName: file, source: file },
    } as never)
  }
  const receipts = () => output.split('\n').filter(Boolean).map(line => JSON.parse(line.slice(NATIVE_PUBLICATION_PREFIX.length)) as NativePublicationReceipt)
  return { root, render, requests, receipts, close: () => close.call(context as never) }
}

it('publishes committed views in hook order even when a later commit resolves first', async () => {
  const run = await fixture()
  await run.render('earlier.txt')
  await run.render('later.txt')
  run.requests.get(2)!.resolve({ root: run.root, epoch: 2, outputs: new Map([['later.txt', 'later.txt']]) })
  await run.requests.get(2)!.promise
  expect(run.receipts()).toEqual([])
  run.requests.get(1)!.resolve({ root: run.root, epoch: 1, outputs: new Map([['earlier.txt', 'earlier.txt']]) })
  // 关闭只取消未提交请求；已经提交的有序输入检查仍须完整结束。
  await run.requests.get(1)!.promise
  await run.close()
  expect(run.receipts().map(receipt => receipt.publicationEpoch)).toEqual([1, 2])
  expect(run.receipts().map(receipt => receipt.outputScope)).toEqual(['committed-root', 'committed-root'])
})

it.each(['wrong-root', 'wrong-epoch', 'missing-output', 'wrong-bytes', 'uncommitted'] as const)('rejects a byte-write complete view with %s', async (variant) => {
  const run = await fixture()
  await run.render('app.js')
  if (variant !== 'uncommitted') {
    run.requests.get(1)!.resolve({
      root: variant === 'wrong-root' ? path.join(run.root, 'other') : run.root,
      epoch: variant === 'wrong-epoch' ? 2 : 1,
      outputs: new Map([[variant === 'missing-output' ? 'other.js' : 'app.js', variant === 'wrong-bytes' ? 'other bytes' : 'app.js']]),
    })
    await run.requests.get(1)!.promise
  }
  await run.close()
  expect(run.receipts()).toEqual([])
})

it('handles a later rejection immediately while retaining the earlier observation and the original close failure', async () => {
  const run = await fixture()
  await run.render('earlier.txt')
  await run.render('later.txt')
  const failure = new Error('later native commit rejected')
  run.requests.get(2)!.reject(failure)
  // 跨过事件循环检查未处理拒绝，不能只在最终 close 后补接错误处理。
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(run.receipts()).toEqual([])
  run.requests.get(1)!.resolve({ root: run.root, epoch: 1, outputs: new Map([['earlier.txt', 'earlier.txt']]) })
  await run.requests.get(1)!.promise
  await expect(run.close()).rejects.toBe(failure)
  expect(run.receipts().map(receipt => receipt.publicationEpoch)).toEqual([1])
})

it.each(['dist', 'output/miniapp'])('ignores other output roots before requesting a complete view for %s', async (outputRoot) => {
  const run = await fixture(outputRoot)
  await run.render('foreign.js', path.join(run.root, 'other'))
  expect(run.requests.size).toBe(0)
  await run.render('app.js')
  run.requests.get(2)!.resolve({ root: run.root, epoch: 2, outputs: new Map([['app.js', 'app.js']]) })
  await run.requests.get(2)!.promise
  await run.close()
  expect(run.receipts().map(receipt => receipt.publicationEpoch)).toEqual([2])
})
