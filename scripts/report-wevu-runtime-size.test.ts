import type { RuntimeSizeReport, RuntimeSizeTierReport } from './runtime-size'

import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseRuntimeSizeCliOptions, runRuntimeSizeCli } from './report-wevu-runtime-size'
import { runtimeSizeTargets, runtimeSizeTiers } from './runtime-size'

function createReport(commit: string, minimalBytes: number): RuntimeSizeReport {
  return {
    version: 3,
    generatedAt: '2026-09-04T00:00:00.000Z',
    commit,
    targets: runtimeSizeTargets.map(target => ({
      id: target.id,
      label: target.label,
      tiers: runtimeSizeTiers.map((tier): RuntimeSizeTierReport => {
        const entry = `wevu-runtime-size-${target.id}-${tier.id}-production.mjs`
        return {
          id: tier.id,
          label: tier.label,
          dev: { bytes: 1 },
          production: {
            bytes: target.id === 'weapp' && tier.id === 'minimal-app' ? minimalBytes : 1,
            retainedModules: {
              entry,
              modules: [{ path: entry, bytesInOutput: 1, imports: [] }],
            },
          },
        }
      }),
    })),
  }
}

describe('runtime size report CLI', () => {
  it('parses the check flag without changing existing report options', () => {
    expect(parseRuntimeSizeCliOptions([
      '--root=fixture',
      '--current-json=current.json',
      '--baseline-json=baseline.json',
      '--check',
    ], '/workspace')).toMatchObject({
      root: '/workspace/fixture',
      currentJson: 'current.json',
      baselineJson: 'baseline.json',
      build: false,
      check: true,
      githubSummary: false,
    })
  })

  it('writes raw JSON, markdown, and artifact before a check failure', async () => {
    const outputMarkdown = path.resolve('out/report.md')
    const current = createReport('abc1234', 93_536)
    const baseline = createReport('def5678', 93_535)
    const events: string[] = []
    const writtenJson: unknown[] = []
    const readReport = vi.fn(async (file: string) => file === 'head.json' ? current : baseline)

    await expect(runRuntimeSizeCli({
      root: '/repo',
      build: false,
      check: true,
      currentJson: 'head.json',
      baselineJson: 'baseline.json',
      outputJson: 'out/head.json',
      outputMarkdown,
      artifactJson: 'out/report.json',
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      githubSummary: false,
    }, {
      ensureParentDirectory: async (file) => {
        events.push(`ensure:${file}`)
      },
      readReport,
      writeJson: async (file, value) => {
        events.push(`json:${file}`)
        writtenJson.push(value)
      },
      writeStdout: () => {
        events.push('stdout')
      },
      writeText: async (file) => {
        events.push(`text:${file}`)
      },
    })).rejects.toThrowError([
      'Runtime size guard failed with 1 violation(s):',
      '- target=weapp tier=minimal-app mode=production: actual=93536 B ceiling=93535 B.',
    ].join('\n'))

    expect(events).toEqual([
      'ensure:out/head.json',
      'json:out/head.json',
      `ensure:${outputMarkdown}`,
      `text:${outputMarkdown}`,
      'ensure:out/report.json',
      'json:out/report.json',
      'stdout',
    ])
    expect(readReport).toHaveBeenNthCalledWith(1, 'head.json')
    expect(readReport).toHaveBeenNthCalledWith(2, 'baseline.json')
    expect(writtenJson[0]).toBe(current)
    expect(writtenJson[1]).toEqual(expect.objectContaining({
      version: 3,
      kind: 'wevu-runtime-size-pr-report',
      current,
      baseline,
    }))
  })
})
