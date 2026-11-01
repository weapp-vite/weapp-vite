import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import simulatorConfig from '../mpcore/packages/simulator/vitest.e2e.config'
import { readVerificationTopologyVariant, readWorkflowFixture } from './workflowFixture.mjs'

const root = path.resolve(import.meta.dirname, '..')
const simulatorRoot = path.join(root, 'mpcore/packages/simulator')
const normalize = (file: string) => file.replaceAll('\\', '/')

interface Workflow {
  jobs: Record<string, { with?: { main_command?: string } }>
}

describe('simulator browser CI coverage', () => {
  it('includes every browser scenario and automatically discovers future scenarios', async () => {
    const browserRoot = path.join(simulatorRoot, 'e2e')
    const scenarios = (await readdir(browserRoot, { recursive: true }))
      .filter(file => file.endsWith('.e2e.test.ts'))
      .map(file => normalize(path.join(browserRoot, file)))
    const include = simulatorConfig.test?.include ?? []
    const exclude = simulatorConfig.test?.exclude ?? []
    const included = (file: string) => include.some(pattern => path.matchesGlob(file, pattern))
      && !exclude.some(pattern => path.matchesGlob(file, pattern))
    expect(scenarios.length).toBeGreaterThan(0)
    expect(scenarios.filter(included).sort()).toEqual(scenarios.sort())
    for (const file of ['future.e2e.test.ts', 'nested/future.e2e.test.ts']) {
      expect(included(normalize(path.join(browserRoot, file)))).toBe(true)
    }
    expect(included(normalize(path.join(simulatorRoot, 'test/unit.test.ts')))).toBe(false)
  })

  it('runs the browser suite through the cloud CI entry', async () => {
    const baseline = readVerificationTopologyVariant() === 'baseline'
    const workflow = readWorkflowFixture(baseline ? 'validate-ci-e2e.yml' : 'reusable-miniapp-platform.yml') as Workflow
    const command = 'pnpm --filter @mpcore/simulator test:e2e'
    const diagnostics = `pnpm exec cross-env DEBUG=vitest:browser:*,pw:browser VITEST_PW_DEBUG=1 ${command}`
    expect(workflow.jobs['simulator-browser']?.with?.main_command).toBe(baseline ? command : `$${'{{'} inputs.runs_on == 'windows-latest' && '${diagnostics}' || '${command}' }}`)
    const manifest = JSON.parse(await readFile(path.join(simulatorRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(manifest.scripts['test:e2e']).toMatch(/(?:--config|-c) (?:\.\/)?vitest\.e2e\.config\.ts(?: |$)/)
  })
})
