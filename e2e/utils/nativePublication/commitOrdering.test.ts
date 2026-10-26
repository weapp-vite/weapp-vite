import type { OutputBundle } from 'rolldown'
import type { NativeOutputPublicationSnapshot } from '../../../packages/weapp-vite/src/plugins/outputFinalizer/publicationObservation'
import type { NativePublicationProfileIdentity, NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { captureNativePublication } from '.'
import { createDevBuildCompletion } from '../devBuildCompletion'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationHash } from './files'
import { nativePublicationPlugin } from './plugin'

const reads = vi.hoisted(() => ({ block: undefined as (() => Promise<void>) | undefined }))
vi.mock('./files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./files')>()
  return {
    ...actual,
    readNativePublicationInputs: async (...args: Parameters<typeof actual.readNativePublicationInputs>) => {
      const block = reads.block
      reads.block = undefined
      await block?.()
      return actual.readNativePublicationInputs(...args)
    },
  }
})

function handler<T extends (...args: never[]) => unknown>(hook: T | { handler: T } | undefined): T {
  return typeof hook === 'function' ? hook : hook!.handler
}

function sourceEnd(identity: NativePublicationProfileIdentity) {
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'ordered-session',
    ...identity,
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: identity.sourceEvents.map(event => ({ ...event, event: 'update', receivedAtMs: performance.now() })),
  })}\n`
}

it('preserves both source END identities and commit order when a later epoch overwrites disk before earlier observation finishes', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-order-'))
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let output = ''
  const nativeWrite = process.stdout.write.bind(process.stdout)
  const capture = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (nativeWrite as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const observer = nativePublicationPlugin({ profilePath: path.join(project, 'profile.jsonl') })
  try {
    const script = path.join(project, 'src/app.js')
    const style = path.join(project, 'src/optional.css')
    const outDir = path.join(project, 'dist')
    const profilePath = path.join(project, 'profile.jsonl')
    await mkdir(path.join(project, 'src'))
    await mkdir(outDir)
    await writeFile(script, 'Page({ final: true })')
    await writeFile(style, '.optional {}')
    await writeFile(profilePath, '')
    const first: NativePublicationProfileIdentity = { buildId: 'ordered-session:1', batchId: 'style-batch', sourceEvents: [{ eventId: 'style-event', file: style }] }
    const second: NativePublicationProfileIdentity = { buildId: 'ordered-session:2', batchId: 'page-batch', sourceEvents: [{ eventId: 'page-event', file: script }] }
    let epoch = 1
    const commits = [Promise.withResolvers<NativeOutputPublicationSnapshot>(), Promise.withResolvers<NativeOutputPublicationSnapshot>()]
    const profile = { ...first }
    const environment = { config: {
      root: project,
      build: { outDir },
      plugins: [
        { name: 'weapp-vite:context', api: { ctx: { runtimeState: { build: { hmr: { profile } } } } } },
        { name: WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME, api: {
          getEpoch: () => epoch,
          whenCommitted: (root: string, capturedEpoch: number) => {
            expect(root).toBe(outDir)
            return commits[capturedEpoch - 1]!.promise
          },
        } },
      ],
    } }
    const context = { environment }
    const bundle = { 'app.js': { type: 'asset', fileName: 'app.js', source: 'Page({})' } } as OutputBundle
    const write = async () => {
      await handler(observer.buildStart).call(context as never, {} as never)
      await handler(observer.generateBundle).call(context as never, { dir: outDir } as never, bundle, true)
      await handler(observer.writeBundle).call(context as never, { dir: outDir } as never, bundle)
    }
    const dev = { getOutput: () => output, waitFor: async <T>(task: Promise<T>) => task }
    const publication = captureNativePublication(dev, project, { expectedSourceFiles: [style, script] })
    const completion = createDevBuildCompletion(dev, { source: { files: [style, script], profilePath } })
    await write()
    reads.block = async () => {
      entered.resolve()
      await release.promise
    }
    commits[0]!.resolve({ epoch: 1, root: outDir, outputs: new Map([['app.js', 'Page({ intermediate: true })'], ['optional.wxss', '.optional {}']]) })
    await entered.promise
    const firstEnd = sourceEnd(first)
    await writeFile(profilePath, firstEnd)
    epoch = 2
    Object.assign(profile, second)
    await write()
    await writeFile(path.join(outDir, 'app.js'), 'Page({ final: true })')
    commits[1]!.resolve({ epoch: 2, root: outDir, outputs: new Map([['app.js', 'Page({ final: true })']]) })
    await writeFile(profilePath, firstEnd + sourceEnd(second))
    expect(output).toBe('')
    release.resolve()
    await handler(observer.closeBundle).call(context as never)
    const receipts = output.trim().split('\n').map(line => JSON.parse(line.slice(NATIVE_PUBLICATION_PREFIX.length)) as NativePublicationReceipt)
    expect(receipts.map(receipt => receipt.publicationEpoch)).toEqual([1, 2])
    expect(receipts[0]?.outputs['app.js']).toBe(nativePublicationHash('Page({ intermediate: true })'))
    const final = await publication.wait(1_000)
    expect(final.outputs).toEqual({ 'app.js': nativePublicationHash('Page({ final: true })') })
    expect(final.sourcePublications?.map(value => value.cursor.identity)).toEqual([first, second])
    await expect(completion.wait(1_000, final.sourcePublications)).resolves.toBeUndefined()
  }
  finally {
    release.resolve()
    reads.block = undefined
    capture.mockRestore()
    await rm(project, { recursive: true, force: true })
  }
})
