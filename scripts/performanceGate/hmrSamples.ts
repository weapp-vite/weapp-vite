import type { AuditSample } from './collect'

interface HmrSample { wallMs: number, phase: string, rssBytes?: number, heapUsedBytes?: number, timingSource?: string, profileStatus?: string }
export interface HmrReport {
  templates: Array<{ id: string, error?: string, scenarios: Array<{ id: string, error?: string, samples: HmrSample[], cycles?: Array<{ edit: HmrSample, restore: HmrSample }> }> }>
}

/** 保留同轮其他场景的证据，失败场景不伪造耗时或补齐样本。 */
export class PartialHmrCollectionError extends Error {
  constructor(readonly samples: AuditSample[], failures: string[]) {
    super(failures.join('; '))
    this.name = 'PartialHmrCollectionError'
  }
}

/** 按场景核验，局部失败不能吞掉同一会话内已完成的其他采集。 */
export function readHmrSamples(report: HmrReport, runtime: string): AuditSample[] {
  const samples: AuditSample[] = []
  const failures: string[] = []
  for (const template of report.templates) {
    if (template.error || !template.scenarios.length) {
      failures.push(`${template.id}: ${template.error ?? 'missing scenarios'}`)
      continue
    }
    for (const scenario of template.scenarios) {
      if (scenario.error || scenario.samples.length !== 2 || scenario.cycles?.length !== 2) {
        failures.push(`${template.id}/${scenario.id}: ${scenario.error ?? 'incomplete edit/restore cycles'}`)
        continue
      }
      for (const [index, cycle] of scenario.cycles.entries()) {
        const phase = index === 0 ? 'first' : 'repeat'
        for (const action of ['edit', 'restore'] as const) {
          const sample = cycle[action]
          if (!Number.isFinite(sample.wallMs) || sample.wallMs <= 0 || sample.phase !== action) {
            failures.push(`${template.id}/${scenario.id}: Invalid HMR output observation`)
            continue
          }
          const profile = sample.timingSource === 'compiler-profile'
            ? Object.fromEntries(Object.entries(sample).filter(([key, value]) => key !== 'wallMs' && key.endsWith('Ms') && typeof value === 'number')) as Record<string, number>
            : undefined
          samples.push({ id: `hmr:${runtime}:${template.id}:${scenario.id}:${phase}:${action}`, template: template.id, phase: `${phase}:${action}`, ms: sample.wallMs, rssBytes: sample.rssBytes, heapBytes: sample.heapUsedBytes, profile, profileStatus: sample.profileStatus })
        }
      }
    }
  }
  if (failures.length) {
    throw new PartialHmrCollectionError(samples, failures)
  }
  return samples
}
