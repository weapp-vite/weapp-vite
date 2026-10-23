import type { Plugin } from 'vite'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { build } from 'vite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { captureNativePublication } from '.'
import { createDevBuildCompletion } from '../devBuildCompletion'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'
import { nativePublicationPlugin } from './plugin'

let project: string
let output: string
let watcher: { close: () => Promise<void> } | undefined

beforeEach(async () => {
  project = await mkdtemp(path.join(tmpdir(), 'native-publication-'))
  await mkdir(path.join(project, 'src'))
  await writeFile(path.join(project, 'src/app.js'), 'console.info("BASE")')
  await writeFile(path.join(project, 'src/app.json'), '{"pages":["pages/index"]}')
  output = ''
  const write = process.stdout.write.bind(process.stdout)
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (write as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
})

afterEach(async () => {
  await watcher?.close()
  watcher = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  await rm(project, { recursive: true, force: true })
})

function dev() {
  return {
    getOutput: () => output,
    waitFor: async <T>(task: Promise<T>) => await task,
  }
}

async function nativeBuild(options: { write?: boolean, watch?: boolean, observe?: boolean, profilePath?: string, plugins?: Plugin[], afterObserverPlugins?: Plugin[] } = {}) {
  return await build({
    root: project,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'fixture:app-config',
        async generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'app.json', source: await readFile(path.join(project, 'src/app.json'), 'utf8') })
        },
      },
      ...(options.plugins ?? []),
      ...(options.observe === false ? [] : [nativePublicationPlugin({ profilePath: options.profilePath })]),
      ...(options.afterObserverPlugins ?? []),
    ],
    build: {
      write: options.write,
      ...(options.watch ? { watch: { buildDelay: 10 } } : {}),
      minify: false,
      rolldownOptions: {
        input: path.join(project, 'src/app.js'),
        output: { entryFileNames: 'app.js' },
      },
    },
  })
}

it('observes a real native write without changing emitted files or their bytes', async () => {
  const pending = captureNativePublication(dev(), project)
  await nativeBuild()
  const receipt = await pending.wait()
  expect(Object.keys(receipt.outputs).sort()).toEqual(['app.js', 'app.json'])
  expect(receipt.inputs['src/app.js']).toBe(nativePublicationHash('console.info("BASE")'))
  expect(receipt.inputs['src/app.json']).toBe(nativePublicationHash('{"pages":["pages/index"]}'))
  output = ''
  await nativeBuild({ observe: false })
  for (const [file, hash] of Object.entries(receipt.outputs)) {
    expect(nativePublicationHash(await readFile(path.join(project, 'dist', file)))).toBe(hash)
  }
  expect(output).toBe('')
})

it('does not acknowledge write:false snapshots or independent in-memory builds', async () => {
  await nativeBuild({ write: false })
  expect(output).toBe('')
  expect(await access(path.join(project, 'dist')).then(() => true, () => false)).toBe(false)
})

it('does not acknowledge a generation whose source changed during native compilation', async () => {
  await nativeBuild({
    plugins: [{
      name: 'fixture:source-changed-during-build',
      async renderStart() {
        await writeFile(path.join(project, 'src/app.js'), 'console.info("FINAL")')
      },
    }],
  })
  expect(output).toBe('')
})

it('retains a previous native write hook failure without producing a success receipt', async () => {
  await expect(nativeBuild({
    plugins: [{
      name: 'fixture:failed-native-write',
      enforce: 'post',
      writeBundle: {
        order: 'post',
        sequential: true,
        handler() { throw new Error('native write rejected') },
      },
    }],
  })).rejects.toThrow('native write rejected')
  expect(output).toBe('')
})

it('does not combine an earlier source success with bytes whose later native commit hook rejects', async () => {
  const source = path.join(project, 'src/app.js')
  const profilePath = path.join(project, 'hmr-profile.jsonl')
  const completion = createDevBuildCompletion(dev(), { source: { file: source, profilePath } })
  const earlier = `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'native-session',
    buildId: 'earlier-build',
    batchId: 'earlier-batch',
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: [{ eventId: 'earlier-event', event: 'update', file: source, receivedAtMs: performance.now() }],
  })}\n`
  await writeFile(profilePath, earlier)
  const pending = captureNativePublication(dev(), project)
  await expect(nativeBuild({
    profilePath,
    afterObserverPlugins: [{
      name: 'fixture:failed-late-native-commit',
      enforce: 'post',
      writeBundle: {
        order: 'post',
        sequential: true,
        handler() { throw new Error('late native commit rejected') },
      },
    }],
  })).rejects.toThrow('late native commit rejected')
  // 这些字节确实已写出，closeBundle 却不携带 writeBundle 的拒绝；正式成功必须独立等待。
  const receipt = await pending.wait()
  expect(receipt.boundary).toBe('native-byte-write')
  expect(receipt.profileCursor).toEqual({ offset: earlier.length, prefixHash: nativePublicationHash(earlier) })
  await expect(completion.wait(100, receipt.profileCursor)).rejects.toThrow('Timed out waiting for current dev build')
})

it('keeps worker output separate even when its real write uses the app output directory', async () => {
  await nativeBuild({ plugins: [{ name: 'weapp-vite:workers' }] })
  expect(output).toBe('')
})

it('closes every native watch publication before watcher shutdown, including consecutive partial writes', async () => {
  let builds = 0
  const first = captureNativePublication(dev(), project)
  const result = await nativeBuild({
    watch: true,
    plugins: [{
      name: 'fixture:partial-native-output',
      enforce: 'post',
      buildStart() { builds++ },
      generateBundle: {
        order: 'post',
        async handler(_options, bundle) {
          if (builds > 1) {
            delete bundle['app.js']
            delete bundle['app.json']
            this.emitFile({ type: 'asset', fileName: 'pages/native/index.js', source: await readFile(path.join(project, 'src/app.js'), 'utf8') })
          }
        },
      },
    }],
  })
  if (Array.isArray(result) || !('on' in result) || !('close' in result)) {
    throw new Error('Expected a real native build watcher')
  }
  watcher = result
  await first.wait(10_000)
  for (const marker of ['NEXT', 'FINAL']) {
    const pending = captureNativePublication(dev(), project)
    const source = `console.info("${marker}")`
    await writeFile(path.join(project, 'src/app.js'), source)
    const receipt = await pending.wait(10_000)
    expect(receipt.boundary).toBe('native-byte-write')
    expect(receipt.outputs).toEqual({ 'pages/native/index.js': nativePublicationHash(source) })
  }
  // 原生 watcher 可以合并或重复底层文件事件；关闭后逐轮核对发布，不能把保存次数当成构建次数。
  await watcher.close()
  watcher = undefined
  expect(builds).toBeGreaterThanOrEqual(3)
  const emitted = output.split('\n').filter(line => line.startsWith(NATIVE_PUBLICATION_PREFIX)).map(line => JSON.parse(line.slice(NATIVE_PUBLICATION_PREFIX.length)))
  expect(emitted, JSON.stringify({ builds, emitted })).toHaveLength(builds)
}, 30_000)

it('rejects a newly logged receipt from an earlier source generation', async () => {
  await nativeBuild()
  const stale = output
  const pending = captureNativePublication(dev(), project)
  await writeFile(path.join(project, 'src/app.js'), 'console.info("FINAL")')
  output += stale
  await expect(pending.wait(100)).rejects.toThrow('final source generation')
})

it('rejects a complete receipt when later native output has replaced its actual files', async () => {
  const pending = captureNativePublication(dev(), project)
  await nativeBuild()
  await nativeBuild({
    observe: false,
    plugins: [{
      name: 'fixture:later-output',
      renderChunk(code) { return `${code}\nconsole.info("later output")` },
    }],
  })
  await expect(pending.wait(100)).rejects.toThrow('final source generation')
})

it('reports stale input hashes, changed output bytes and missing files at publication timeout', async () => {
  const pending = captureNativePublication(dev(), project)
  const inputs = await readNativePublicationInputs(project)
  const expected = nativePublicationHash('expected output')
  const actual = nativePublicationHash('actual output')
  const source = 'console.info("FINAL")'
  const outputs = { 'app.js': expected, 'app.json': nativePublicationHash('expected config') }
  await mkdir(path.join(project, 'dist'))
  await writeFile(path.join(project, 'dist/app.js'), 'actual output')
  await writeFile(path.join(project, 'src/app.js'), source)
  output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({ boundary: 'native-byte-write', generation: nativePublicationGeneration(outputs), inputs, outputs })}\n`
  try {
    await pending.wait(100)
    expect.unreachable('A stale receipt with mismatched disk bytes cannot pass')
  }
  catch (error) {
    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toContain('final source generation')
    expect(message).toContain(`"file":"src/app.js","expected":"${nativePublicationHash(source)}","actual":"${inputs['src/app.js']}"`)
    expect(message).toContain(`"file":"app.js","expected":"${expected}","actual":"${actual}"`)
    expect(message).toContain(`"file":"app.json","expected":"${outputs['app.json']}","error":"ENOENT"`)
    expect(message).not.toContain(project)
    expect(message).not.toContain('actual output')
  }
})

it('stops polling at child exit instead of reading a released fixture until the publication deadline', async () => {
  vi.useFakeTimers()
  const failure = new Error('native child exited')
  const pending = captureNativePublication({
    getOutput: () => output,
    waitFor: async () => { throw failure },
  }, project)
  await expect(pending.wait()).rejects.toBe(failure)
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(90_000)
  expect(vi.getTimerCount()).toBe(0)
})
