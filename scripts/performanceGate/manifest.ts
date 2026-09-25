import type { Checkout } from './collect'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { runCollector } from './process'

export interface ScenarioManifest {
  templates: Array<{ id: string, scenarios: string[] }>
  metrics: string[]
}

/** 在计时前固定场景集合，两侧缺少模板或场景均不能通过。 */
export async function discoverManifest(checkouts: { baseline: Checkout, optimized: Checkout }, driver: string, output: string): Promise<ScenarioManifest> {
  const plans = []
  for (const checkout of [checkouts.baseline, checkouts.optimized]) {
    const reportDir = path.join(output, 'manifest', checkout.id)
    await runCollector(process.execPath, ['--import', 'tsx', 'scripts/benchmark-templates-hmr.ts'], {
      logFile: path.join(reportDir, 'plan.log'),
      timeoutMs: 120_000,
      cwd: driver,
      env: {
        TEMPLATES_HMR_REPO_ROOT: checkout.cwd,
        TEMPLATES_HMR_REPORT_DIR: reportDir,
        TEMPLATES_HMR_WORKSPACE_ROOT: path.join(reportDir, 'workspace'),
        TEMPLATES_HMR_FILTER: checkout.templates.map(item => item.id).join(','),
        TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE: process.env.TEMPLATES_PERF_HMR_MAX_SCENARIOS_PER_TEMPLATE ?? '4',
        TEMPLATES_HMR_PLAN_ONLY: '1',
      },
    })
    const plan = JSON.parse(await readFile(path.join(reportDir, 'manifest.json'), 'utf8')) as ScenarioManifest['templates']
    if (plan.map(item => item.id).sort().join(',') !== checkout.templates.map(item => item.id).sort().join(',') || plan.some(item => !item.scenarios.length)) {
      throw new Error('Missing declared performance templates or scenarios')
    }
    plans.push(plan)
  }
  if (JSON.stringify(plans[0]) !== JSON.stringify(plans[1])) {
    throw new Error('Baseline/current scenario manifests differ')
  }
  const templates = plans[0]!
  const metrics = templates.flatMap(template => [
    ...['first', 'repeat'].map(phase => `build:${template.id}:${phase}`),
    ...['classic', 'stateful-experimental'].flatMap(runtime => template.scenarios.flatMap(scenario => ['first', 'repeat'].flatMap(phase => ['edit', 'restore'].map(action => `hmr:${runtime}:${template.id}:${scenario}:${phase}:${action}`)))),
  ])
  return { templates, metrics }
}

export function assertManifestMetrics(manifest: ScenarioManifest, actual: string[]) {
  const expected = new Set(manifest.metrics)
  if (!expected.size || expected.size !== manifest.metrics.length || new Set(actual).size !== actual.length || actual.length !== expected.size || actual.some(id => !expected.has(id))) {
    throw new Error('Missing or unexpected performance scenario evidence')
  }
}
