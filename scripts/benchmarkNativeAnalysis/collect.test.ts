import type { Run } from './contract'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runCollector } from '../performanceGate/process'
import { collectRun } from './collect'
import { INPUTS, parseOptions } from './contract'
import { stageInput } from './stage'

vi.mock('../performanceGate/process', () => ({ runCollector: vi.fn() }))
vi.mock('./stage', () => ({ stageInput: vi.fn() }))
vi.mock('./native', async importOriginal => ({ ...await importOriginal<typeof import('./native')>(), createDiagnosticBinding: vi.fn() }))
vi.mock('./diagnosticObservation', async importOriginal => ({ ...await importOriginal<typeof import('./diagnosticObservation')>(), createDiagnosticPreload: vi.fn() }))

afterEach(() => vi.resetAllMocks())

it.each([false, true])('preserves the worker error and collects dependency reads only in diagnostic mode (%s)', async (diagnostic) => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-collect-'))
  try {
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'binding.node')])
    const owned = path.join(options.output, '.workspace')
    const project = path.join(owned, 'input', INPUTS[0].id)
    await mkdir(project, { recursive: true })
    vi.mocked(stageInput).mockResolvedValue({ owned, project, sourceDigest: 'source', inputDigest: 'input', manifest: {} })
    vi.mocked(runCollector).mockImplementation(async (_command, args, collectorOptions) => {
      if (args.includes('prepare')) {
        const evidence = path.join(path.dirname(collectorOptions.logFile), 'dependency-layout.json')
        if (diagnostic) {
          const layout = JSON.parse(await readFile(evidence, 'utf8')) as { locations: Array<{ stat: { ok: boolean, code: string } }> }
          expect(layout.locations.map(location => location.stat)).toEqual(Array.from({ length: 3 }, () => ({ ok: false, code: 'ENOENT' })))
        }
        else {
          await expect(readFile(evidence)).rejects.toMatchObject({ code: 'ENOENT' })
        }
        return { exitCode: 0, all: '', message: '' }
      }
      else {
        const job = JSON.parse(await readFile(collectorOptions.env!.NATIVE_BENCHMARK_JOB_FILE!, 'utf8')) as { directory: string, result: Run }
        await writeFile(path.join(job.directory, 'sample.json'), JSON.stringify({ ...job.result, error: 'Error: Build failed (1)' }))
        throw new Error('Collector failed: exit=1')
      }
    })
    const result = await collectRun(options, INPUTS[0], 'build', 'on', 0, 'primary', diagnostic)
    expect(runCollector).toHaveBeenCalledTimes(2)
    expect(result.error).toBe('Error: Build failed (1)')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('retains a sanitized collector error when no worker error was produced', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-collect-error-'))
  try {
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'binding.node')])
    vi.mocked(stageInput).mockResolvedValue({ owned: options.output, project: path.join(root, 'project'), sourceDigest: 'source', inputDigest: 'input', manifest: {} })
    vi.mocked(runCollector).mockRejectedValue(new Error(`Prepare failed in ${root}`))
    const result = await collectRun(options, INPUTS[0], 'build', 'off', 0, 'primary')
    expect(result.error).toBe('Error: Prepare failed in <workspace>')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
