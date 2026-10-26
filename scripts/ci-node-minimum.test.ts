import { readdirSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
// eslint-disable-next-line e18e/ban-dependencies -- setup-node 使用 semver 选择缓存和发行版本，回归须保持相同范围语义。
import { inc, maxSatisfying, minVersion, satisfies } from 'semver'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface SetupStep {
  uses?: string
  with?: Record<string, unknown>
}

interface Workflow {
  jobs: Record<string, { steps?: SetupStep[] }>
}

function workflow(name: string): Workflow {
  return parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')) as Workflow
}

const manifest = JSON.parse(readFileSync(new URL('../packages/weapp-vite/package.json', import.meta.url), 'utf8')) as { engines: { node: string } }
const engine = manifest.engines.node
const minimums = engine.split(' || ').map((range) => {
  const minimum = minVersion(range)!
  return { major: String(minimum.major), minimum: minimum.version }
})
const action = parse(readFileSync(new URL('../.github/actions/setup-node-pnpm/action.yml', import.meta.url), 'utf8')) as { runs: { steps: SetupStep[] } }
const setup = (steps: SetupStep[]) => steps.find(step => step.uses?.startsWith('actions/setup-node@'))!
const contexts = [
  { name: 'shared setup', step: setup(action.runs.steps), reference: 'inputs.node-version' },
  { name: 'consumer runtime switch', step: setup(workflow('reusable-consumer-platform.yml').jobs['node-support']!.steps!), reference: 'matrix.node' },
  { name: 'scaffold runtime', step: setup(workflow('validate-ci-create-weapp-vite.yml').jobs.smoke!.steps!), reference: 'matrix.node-version' },
]

/** 仅求值当前 setup 中的布尔/字符串选择表达式，不加载 workflow 或执行任何 job。 */
function selected(value: unknown, requested: string, reference: string): unknown {
  if (typeof value === 'string' && value.startsWith('${{')) {
    const expression = value.slice(3, -2).replaceAll(reference, 'requested')
    return runInNewContext(expression, { requested })
  }
  return value
}

describe('ordinary CI Node setup before candidate installation', () => {
  for (const context of contexts) {
    it.each(minimums)(`${context.name} excludes an obsolete cached Node $major and retains latest-major lookup`, ({ major, minimum }) => {
      const selector = String(selected(context.step.with?.['node-version'], major, context.reference))
      const old = major === '24' ? '24.21.0' : minimum.replace(/\d+$/, patch => String(Number(patch) - 1))
      const latest = inc(minimum, 'patch')!
      expect(maxSatisfying([old], selector)).toBeNull()
      expect(maxSatisfying([old, minimum, latest], selector)).toBe(latest)
      expect(satisfies(minimum, selector)).toBe(true)
      expect(satisfies(`${Number(major) + 1}.0.0`, selector)).toBe(false)
      expect(selected(context.step.with?.['check-latest'], major, context.reference)).toBe(true)
      expect(satisfies(latest, engine)).toBe(true)
    })

    it.each(minimums)(`${context.name} preserves the independent exact $minimum lane`, ({ minimum }) => {
      expect(selected(context.step.with?.['node-version'], minimum, context.reference)).toBe(minimum)
      expect(Boolean(selected(context.step.with?.['check-latest'], minimum, context.reference))).toBe(false)
    })
  }

  it('preserves an explicitly fixed historical performance runtime without remapping it', () => {
    const shared = contexts[0]!
    expect(selected(shared.step.with?.['node-version'], '24.18.0', shared.reference)).toBe('24.18.0')
    expect(Boolean(selected(shared.step.with?.['check-latest'], '24.18.0', shared.reference))).toBe(false)
    for (const name of ['hmr-attribution-acceptance.yml', 'compiler-resource-acceptance.yml']) {
      const selectors = Object.values(workflow(name).jobs).flatMap(job => job.steps ?? []).filter(step => step.uses?.startsWith('actions/setup-node@') || step.uses === './.github/actions/setup-node-pnpm').map(step => String(step.with?.['node-version']))
      expect(selectors).toContain('24.18.0')
    }
  })

  it('protects every direct ordinary setup while retaining explicit minimum consumer lanes', () => {
    const excluded = new Set([
      'hmr-attribution-acceptance.yml',
      'compiler-resource-acceptance.yml',
      'ci-pr-status.yml',
      'reusable-pr-context.yml',
      'ci-performance-comment.yml',
    ])
    const protectedSetups: string[] = []
    for (const name of readdirSync(new URL('../.github/workflows', import.meta.url)).filter(file => file.endsWith('.yml') && !excluded.has(file))) {
      for (const [jobName, job] of Object.entries(workflow(name).jobs)) {
        for (const step of job.steps ?? []) {
          if (!step.uses?.startsWith('actions/setup-node@')) {
            continue
          }
          const value = step.with?.['node-version']
          if (typeof value === 'string' && value.startsWith('${{')) {
            expect(contexts.some(context => context.step.with?.['node-version'] === value)).toBe(true)
          }
          else {
            const minimum = minVersion(String(value))
            expect(minimum, `${name}/${jobName}`).not.toBeNull()
            expect(satisfies(minimum!, engine), `${name}/${jobName}`).toBe(true)
            if (String(value).startsWith('^')) {
              expect(step.with?.['check-latest'], `${name}/${jobName}`).toBe(true)
            }
          }
          protectedSetups.push(`${name}/${jobName}`)
        }
      }
    }
    expect(protectedSetups).toEqual(expect.arrayContaining([
      'validate-ci-performance.yml/smoke',
      'validate-ci-acceptance.yml/compatibility',
      'reusable-consumer-platform.yml/node-support',
      'validate-ci-create-weapp-vite.yml/smoke',
      'validate-wevu-runtime-size.yml/measure',
      'validate-ci-tutorial-e2e.yml/tutorial-e2e',
    ]))
  })
})
