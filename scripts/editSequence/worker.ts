import type { EditAction } from './driver'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { BuildSequenceSession } from './build'
import { observeCompiler } from './compiler'
import { serializeSequenceError } from './errorEvidence'
import { observeProcessResources, SequenceGcObserver } from './measurement'

interface Request {
  id: number
  files: Record<string, string>
  action?: EditAction
  step: number
}

const [mode, root, role = 'incremental'] = process.argv.slice(2)
if (!root || !mode || !['compiler', 'classic', 'stateful-experimental', 'weapp-modes', 'weapp-classic', 'weapp-stateful'].includes(mode)) {
  throw new Error('Edit sequence worker requires mode, project root and role')
}
const outDir = path.join(root, '.sequence-output', role)
const build = mode === 'classic' || mode === 'stateful-experimental' ? new BuildSequenceSession(mode, root, outDir) : undefined
const framework = mode === 'weapp-modes'
  ? new (await import('./weappModes')).WeappModeSequenceSession(path.join(root, role), role !== 'incremental')
  : undefined
const fullFramework = mode === 'weapp-classic' || mode === 'weapp-stateful'
  ? new (await import('./framework')).FrameworkSequenceSession(mode, path.join(root, role))
  : undefined
let active = Promise.resolve()
const gc = new SequenceGcObserver()
let stopping: Promise<void> | undefined
function close() {
  return stopping ??= (async () => {
    await active
    await build?.close()
    await framework?.close()
    await fullFramework?.close()
    gc.close()
    // 仅回收工具创建的 fresh 输出目录；不触碰 fixture 的用户自有内容。
    if (role !== 'incremental') {
      await rm(outDir, { recursive: true, force: true })
      if (framework || fullFramework) {
        await rm(path.join(root, role), { recursive: true, force: true })
      }
    }
    process.exit(0)
  })().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
process.on('message', (request: Request | { type: 'close' }) => {
  if ('type' in request && request.type === 'close') {
    void close()
    return
  }
  if (stopping || 'type' in request) {
    return
  }
  active = active.then(async () => {
    try {
      const input = { ...request, signal: AbortSignal.timeout(fullFramework ? 180_000 : 60_000) }
      const startedAt = performance.now()
      const value = fullFramework ? await fullFramework.observe(input) : framework ? await framework.observe(input) : build ? await build.observe(input) : await observeCompiler(input, root)
      const elapsedMs = performance.now() - startedAt
      const gcSample = await gc.sample(process.env.EDIT_SEQUENCE_RESOURCE_GC === '1')
      process.send?.({ id: request.id, value, measurement: {
        elapsedMs,
        clock: { timeOrigin: performance.timeOrigin, startedAtMs: startedAt, endedAtMs: startedAt + elapsedMs },
        gc: gcSample,
        process: observeProcessResources(),
        build: (build ?? fullFramework)?.measurements.snapshot(),
        session: (build ?? fullFramework)?.observeSession(),
        outputChanges: fullFramework?.outputChanges,
      } })
    }
    catch (error) {
      process.send?.({ id: request.id, error: serializeSequenceError(error) })
    }
  })
})
process.once('SIGTERM', () => {
  void close()
})
