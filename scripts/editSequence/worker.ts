import type { EditAction } from './driver'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { BuildSequenceSession } from './build'
import { observeCompiler } from './compiler'

interface Request {
  id: number
  files: Record<string, string>
  action?: EditAction
  step: number
}

const [mode, root, role = 'incremental'] = process.argv.slice(2)
if (!root || !mode || !['compiler', 'classic', 'stateful-experimental'].includes(mode)) {
  throw new Error('Edit sequence worker requires mode, project root and role')
}
const outDir = path.join(root, '.sequence-output', role)
const build = mode === 'compiler' ? undefined : new BuildSequenceSession(mode as 'classic' | 'stateful-experimental', root, outDir)
let active = Promise.resolve()
process.on('message', (request: Request) => {
  active = active.then(async () => {
    try {
      const input = { ...request, signal: AbortSignal.timeout(60_000) }
      const value = build ? await build.observe(input) : await observeCompiler(input, root)
      process.send?.({ id: request.id, value })
    }
    catch (error) {
      process.send?.({ id: request.id, error: error instanceof Error ? error.stack : String(error) })
    }
  })
})
process.once('SIGTERM', () => {
  void (async () => {
    await build?.close()
    // 仅回收工具创建的 fresh 输出目录；不触碰 fixture 的用户自有内容。
    if (role !== 'incremental') {
      await rm(outDir, { recursive: true, force: true })
    }
    process.exit(0)
  })()
})
