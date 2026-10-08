import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { runCollector } from '../performanceGate/process'
import { collectRun } from './collect'
import { assertCollectionActive, INPUTS, parseOptions } from './contract'

vi.mock('../performanceGate/process', () => ({ runCollector: vi.fn() }))

it('persists interruption evidence and refuses to start the next owned collector', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-interruption-'))
  try {
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'binding.node')])
    const controller = new AbortController()
    options.signal = controller.signal
    controller.abort()
    expect(() => assertCollectionActive(options)).toThrow('no further collectors')
    const run = await collectRun(options, INPUTS[0], 'build', 'off', 0, 'primary')
    expect(run.error).toContain('Benchmark interrupted')
    expect(runCollector).not.toHaveBeenCalled()
    const saved = JSON.parse(await readFile(path.join(options.output, 'primary/build', INPUTS[0].id, '0/off/sample.json'), 'utf8')) as { error: string }
    expect(saved.error).toBe(run.error)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
