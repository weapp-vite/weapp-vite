import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { recordTiming } from '../.github/scripts/ci-timing.mjs'

it('retains failed phase status and measures each phase independently', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ci-timing-'))
  try {
    await recordTiming('start', 'build', 0, root, 100)
    await recordTiming('finish', 'build', 2, root, 250)
    await recordTiming('start', 'test', 0, root, 300)
    const report = await recordTiming('finish', 'test', 0, root, 500)
    expect(report.phases.build).toMatchObject({ durationMs: 150, exitCode: 2 })
    expect(report.phases.test).toMatchObject({ durationMs: 200, exitCode: 0 })
    await expect(recordTiming('finish', 'missing', 0, root)).rejects.toThrow('Missing timing start')
    await expect(recordTiming('start', 'build', 0, root)).rejects.toThrow('Duplicate timing phase')
    await expect(recordTiming('finish', 'build', 0, root)).rejects.toThrow('Duplicate finish')
    await expect(recordTiming('start', 'invalid', 0, root, Number.NaN)).rejects.toThrow('Invalid timing')
    await expect(recordTiming('start', 'invalid', 'not-a-number', root)).rejects.toThrow('Invalid timing')
    await recordTiming('start', 'negative', 0, root, 100)
    await expect(recordTiming('finish', 'negative', 0, root, 99)).rejects.toThrow('negative timing')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
