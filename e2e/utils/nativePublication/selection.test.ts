import type { NativePublicationProfileIdentity, NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { captureNativePublication } from '.'
import { createDevBuildCompletion } from '../devBuildCompletion'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'

const projects: string[] = []

afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

function sourceEnd(identity: NativePublicationProfileIdentity) {
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'overlapping-source-session',
    buildId: identity.buildId,
    batchId: identity.batchId,
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: identity.sourceEvents.map(event => ({ ...event, event: 'update', receivedAtMs: performance.now() })),
  })}\n`
}

it.each(['page', 'all-sources', 'normalized-paths', 'missing-identity'] as const)('waits for the requested %s identity when an earlier publication already contains the final bytes', async (variant) => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-selection-'))
  projects.push(project)
  await mkdir(path.join(project, 'src'))
  await mkdir(path.join(project, 'dist'))
  const page = path.join(project, 'src/page.vue')
  const css = path.join(project, 'src/page.css')
  const profilePath = path.join(project, 'profile.jsonl')
  const script = 'Page({ data: { restored: true } })'
  const style = '.page { color: blue; }'
  await Promise.all([
    writeFile(page, '<view class="page">restored</view>'),
    writeFile(css, style),
    writeFile(path.join(project, 'dist/page.js'), script),
    writeFile(path.join(project, 'dist/page.wxss'), style),
    writeFile(profilePath, ''),
  ])
  let output = ''
  const dev = {
    getOutput: vi.fn(() => output),
    waitFor: async <T>(task: Promise<T>) => task,
  }
  const expectedSourceFiles = variant === 'all-sources' ? [page, css] : [page]
  const publication = captureNativePublication(dev, project, { expectedSourceFiles })
  const completion = createDevBuildCompletion(dev, { source: { files: [page], profilePath } })
  dev.getOutput.mockClear()
  const inputs = await readNativePublicationInputs(project)
  const outputs = { 'page.js': nativePublicationHash(script), 'page.wxss': nativePublicationHash(style) }
  const cssIdentity = {
    buildId: 'overlapping-source-session:7',
    batchId: 'css-batch',
    sourceEvents: [{ eventId: 'css-event', file: css }],
  }
  const pageIdentity = {
    buildId: 'overlapping-source-session:8',
    batchId: 'page-batch',
    sourceEvents: expectedSourceFiles.map((file, index) => ({
      eventId: `restored-event-${index}`,
      file: variant === 'normalized-paths' ? file.replaceAll('/', '\\') : file,
    })),
  }
  const cssEnd = sourceEnd(cssIdentity)
  const cssReceipt: NativePublicationReceipt = {
    boundary: 'native-byte-write',
    generation: nativePublicationGeneration(outputs),
    inputs,
    outputs,
    profileCursor: {
      offset: 0,
      prefixHash: nativePublicationHash(''),
      ...(variant === 'missing-identity' ? {} : { identity: cssIdentity }),
    },
  }
  output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify(cssReceipt)}\n`
  await writeFile(profilePath, cssEnd)
  let settled = false
  const waiting = publication.wait(2_000).then(
    receipt => ({ receipt }),
    (error: unknown) => ({ error }),
  ).then((result) => {
    settled = true
    return result
  })
  try {
    // 第二轮扫描证明第一轮已完成；不以固定等待猜测异步磁盘读取何时结束。
    await vi.waitFor(() => {
      expect(settled || dev.getOutput.mock.calls.length >= 2).toBe(true)
    }, { timeout: 1_000, interval: 5 })
    expect(settled, 'matching bytes from a different source must not freeze the CSS build identity').toBe(false)
  }
  finally {
    const pageReceipt: NativePublicationReceipt = {
      boundary: 'native-noop',
      generation: nativePublicationGeneration(outputs),
      inputs,
      outputs,
      publicationEpoch: 1,
      profileCursor: { offset: cssEnd.length, prefixHash: nativePublicationHash(cssEnd), identity: pageIdentity },
    }
    output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify(pageReceipt)}\n`
    await writeFile(profilePath, cssEnd + sourceEnd(pageIdentity))
    await waiting
  }
  const result = await waiting
  if ('error' in result) {
    throw result.error
  }
  expect(result.receipt.boundary).toBe('native-noop')
  expect(result.receipt.profileCursor?.identity).toEqual(pageIdentity)
  await expect(completion.wait(1_000, result.receipt.profileCursor)).resolves.toBeUndefined()
})
