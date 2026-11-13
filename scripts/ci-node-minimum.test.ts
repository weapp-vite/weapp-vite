/* eslint-disable no-template-curly-in-string -- GitHub Actions 的冻结版本来源按字面量核验。 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- setup-node 使用 semver 选择缓存和发行版本，回归须保持相同范围语义。
import { inc, maxSatisfying, minVersion, satisfies } from 'semver'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { resolveNodeSelector } from '../.github/actions/setup-node/selector.mjs'

interface SetupStep {
  name?: string
  id?: string
  if?: string
  run?: string
  env?: Record<string, string>
  uses?: string
  with?: Record<string, unknown>
}

interface Workflow {
  jobs: Record<string, { steps?: SetupStep[], with?: Record<string, unknown>, outputs?: Record<string, string>, strategy?: { matrix: Record<string, unknown> } }>
}

function workflow(name: string): Workflow {
  return parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')) as Workflow
}

function action(name: string) {
  return parse(readFileSync(new URL(`../.github/actions/${name}/action.yml`, import.meta.url), 'utf8')) as {
    inputs: Record<string, { default?: string }>
    outputs: Record<string, { value: string }>
    runs: { steps: SetupStep[] }
  }
}

const manifest = JSON.parse(readFileSync(new URL('../packages/weapp-vite/package.json', import.meta.url), 'utf8')) as { engines: { node: string } }
const engine = manifest.engines.node
const engineMinimums = engine.split(' || ').map((range) => {
  const minimum = minVersion(range)!
  return { major: String(minimum.major), minimum: minimum.version }
})
const fixedNodeVersion = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim()
const preferredSelectors = engineMinimums.map(({ major }) => ({ major, selector: resolveNodeSelector(major).version }))
const frozenSetupSources = new Map([
  ['reusable-consumer-platform.yml/node-support-v2', '${{ matrix.node }}'],
  ['reusable-consumer-platform.yml/node-support-aggregate-v2', '${{ needs.prepare.outputs.node_version }}'],
  ['reusable-consumer-platform.yml/consumer-aggregate-v2', '${{ needs.prepare.outputs.node_version }}'],
  ['reusable-node-command.yml/run', '${{ steps.toolchain.outputs.node-version }}'],
])

describe('ordinary CI Node setup before candidate installation', () => {
  it.each(preferredSelectors)('excludes an obsolete cached Node $major and retains latest-major lookup', ({ major, selector }) => {
    const preferredFloor = minVersion(selector)!
    expect(selector).toBe(`^${preferredFloor.version}`)
    expect(preferredFloor.major).toBe(Number(major))
    expect(satisfies(preferredFloor, engine)).toBe(true)
    if (major === fixedNodeVersion.split('.')[0]) {
      expect(preferredFloor.version).toBe(fixedNodeVersion)
    }
    let old = `${Number(major) - 1}.0.0`
    if (preferredFloor.patch > 0) {
      old = `${major}.${preferredFloor.minor}.${preferredFloor.patch - 1}`
    }
    else if (preferredFloor.minor > 0) {
      old = `${major}.${preferredFloor.minor - 1}.0`
    }
    const latest = inc(preferredFloor.version, 'patch')!
    expect(maxSatisfying([old], selector)).toBeNull()
    expect(maxSatisfying([old, preferredFloor.version, latest], selector)).toBe(latest)
    expect(satisfies(preferredFloor, selector)).toBe(true)
    expect(satisfies(`${Number(major) + 1}.0.0`, selector)).toBe(false)
    expect(resolveNodeSelector(major).checkLatest).toBe(true)
    expect(satisfies(latest, engine)).toBe(true)
  })

  it.each(engineMinimums)('preserves the independent exact $minimum lane', ({ minimum }) => {
    expect(resolveNodeSelector(minimum)).toEqual({ version: minimum, checkLatest: false })
  })

  it('keeps the default exact and independent from floating major resolution', () => {
    for (const requested of ['', 'default']) {
      expect(resolveNodeSelector(requested)).toEqual({ version: fixedNodeVersion, checkLatest: false })
    }
    expect(resolveNodeSelector(fixedNodeVersion)).toEqual({ version: fixedNodeVersion, checkLatest: false })
    expect(() => resolveNodeSelector('24\ncheck-latest=true')).toThrow('one line')
  })

  it('keeps floating majors independent when the default moves to another major', () => {
    for (const major of ['22', '24', '26']) {
      expect(minVersion(resolveNodeSelector(major, '28.0.0').version)!.major).toBe(Number(major))
    }
    expect(resolveNodeSelector('default', '28.0.0')).toEqual({ version: '28.0.0', checkLatest: false })
  })

  it('reads the fixed version from the action checkout rather than the measured working directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'ci-node-selector-'))
    try {
      const actionDirectory = join(root, 'driver/.github/actions/setup-node')
      const measuredDirectory = join(root, 'head')
      mkdirSync(actionDirectory, { recursive: true })
      mkdirSync(measuredDirectory)
      cpSync(new URL('../.github/actions/setup-node/selector.mjs', import.meta.url), join(actionDirectory, 'selector.mjs'))
      writeFileSync(join(root, 'driver/.node-version'), '24.99.0\n')
      writeFileSync(join(measuredDirectory, '.node-version'), '24.1.0\n')
      const output = join(root, 'output')
      execFileSync(process.execPath, [join(actionDirectory, 'selector.mjs')], {
        cwd: measuredDirectory,
        env: { ...process.env, CI_NODE_VERSION: 'default', GITHUB_OUTPUT: output },
      })
      expect(readFileSync(output, 'utf8')).toBe('node-version=24.99.0\ncheck-latest=false\n')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('shares the selector across both composites without workspace-relative nested action lookup', () => {
    const node = action('setup-node')
    const pnpm = action('setup-node-pnpm')
    const setup = (steps: SetupStep[]) => steps.find(step => step.uses?.startsWith('actions/setup-node@'))!
    expect(setup(node.runs.steps).uses).toBe(setup(pnpm.runs.steps).uses)
    for (const [definition, script] of [[node, 'selector.mjs'], [pnpm, '../setup-node/selector.mjs']] as const) {
      expect(definition.inputs['node-version']!.default).toBe('default')
      expect(definition.runs.steps.find(step => step.id === 'selector')).toMatchObject({
        env: { CI_NODE_VERSION: '${{ inputs.node-version }}' },
        run: `node "$GITHUB_ACTION_PATH/${script}"`,
      })
      expect(setup(definition.runs.steps).with).toMatchObject({
        'node-version': '${{ steps.selector.outputs.node-version }}',
        'check-latest': '${{ steps.selector.outputs.check-latest == \'true\' }}',
      })
      expect(definition.runs.steps.some(step => step.uses?.startsWith('./'))).toBe(false)
    }
    expect(node.runs.steps.some(step => /pnpm|GITHUB_ENV|install|Freeze/u.test(`${step.uses ?? ''} ${step.run ?? ''} ${step.name ?? ''}`))).toBe(false)
    expect(pnpm.inputs['freeze-toolchain']!.default).toBe('true')
    expect(node.outputs['node-version']!.value).toBe('${{ steps.setup.outputs.node-version }}')
    expect(pnpm.outputs['node-version']!.value).toBe('${{ steps.toolchain.outputs.node-version }}')
    expect(pnpm.runs.steps.find(step => step.name === 'Freeze actual toolchain identity')!.if).toBe('inputs.freeze-toolchain == \'true\'')
    expect(pnpm.runs.steps.find(step => step.uses?.startsWith('pnpm/action-setup@'))!.with).toEqual({ package_json_file: '${{ inputs.package-json-file }}' })
    expect(workflow('reusable-consumer-platform.yml').jobs['node-support']!.steps!.find(step => step.uses === './.github/actions/setup-node')!.with).toEqual({ 'node-version': '${{ matrix.node }}' })
    const scaffold = workflow('validate-ci-create-weapp-vite.yml').jobs.smoke!.steps!.find(step => step.uses === './.github/actions/setup-node-pnpm')!
    expect(scaffold.with).toMatchObject({ 'node-version': '${{ matrix.node-version }}', 'cache': '', 'install-dependencies': 'false', 'freeze-toolchain': 'false' })
  })

  it('preserves an explicitly fixed historical performance runtime without remapping it', () => {
    expect(resolveNodeSelector('24.18.0')).toEqual({ version: '24.18.0', checkLatest: false })
    for (const name of ['hmr-attribution-acceptance.yml', 'compiler-resource-acceptance.yml']) {
      const selectors = Object.values(workflow(name).jobs).flatMap(job => job.steps ?? []).filter(step => step.uses?.includes('/setup-node')).map(step => String(step.with?.['node-version']))
      expect(selectors).toContain('24.18.0')
    }
  })

  it('resolves floating support versions before freezing the exact v2 matrix and builder runtime', () => {
    const consumer = workflow('reusable-consumer-platform.yml')
    const run = workflow('reusable-node-command.yml').jobs.run!
    expect(consumer.jobs.prepare!.with).toMatchObject({ node_version: '24', resolve_node_support: '${{ inputs.verification_topology == \'optimized-v2\' }}' })
    expect(run.outputs).toMatchObject({ node_version: '${{ steps.toolchain.outputs.node-version }}', node_support_matrix: '${{ steps.node-support-plan.outputs.matrix }}' })
    expect(consumer.jobs['node-support-v2']!.strategy?.matrix).toEqual({ include: '${{ fromJSON(needs.prepare.outputs.node_support_matrix) }}' })
    for (const major of ['22', '24', '26']) {
      const resolver = run.steps!.find(step => step.id === `support-latest-${major}`)!
      expect(resolver.if).toBe('inputs.resolve_node_support')
      expect(resolver.uses).toBe('./.github/actions/setup-node')
      expect(resolver.with).toEqual({ 'node-version': major })
    }
    expect(run.steps!.find(step => step.id === 'node-support-plan')).toMatchObject({
      if: 'inputs.resolve_node_support',
      env: { SUPPORT_LATEST_22: '${{ steps.support-latest-22.outputs.node-version }}', SUPPORT_LATEST_24: '${{ steps.support-latest-24.outputs.node-version }}', SUPPORT_LATEST_26: '${{ steps.support-latest-26.outputs.node-version }}' },
      run: 'node scripts/nodeSupport/index.mjs plan .cache/node-support-tarballs/ci-provenance.json .tmp/consumer-plan/node-support.json "$SUPPORT_LATEST_22" "$SUPPORT_LATEST_24" "$SUPPORT_LATEST_26"',
    })
    for (const [source, version] of frozenSetupSources) {
      const [file, job] = source.split('/')
      expect(workflow(file!).jobs[job!]!.steps!.some(step => step.uses === './.github/actions/setup-node' && step.with?.['node-version'] === version)).toBe(true)
    }
  })

  it('keeps trusted comparison setup separate from measured manifests, locks and explicit installs', () => {
    for (const name of ['candidate-performance.yml', 'nightly-performance.yml']) {
      const steps = workflow(name).jobs.collect!.steps!
      expect(steps.find(step => step.uses === './driver/.github/actions/setup-node-pnpm')!.with).toEqual({
        'node-version': '24',
        'install-dependencies': 'false',
        'freeze-toolchain': 'false',
        'package-json-file': 'driver/package.json',
        'cache-dependency-path': 'driver/pnpm-lock.yaml',
      })
      expect(steps.filter(step => step.run?.startsWith('pnpm install')).map(step => step.run)).toEqual(Array.from({ length: 3 }).fill('pnpm install --frozen-lockfile --prefer-offline'))
    }
    const sizeSteps = workflow('validate-wevu-runtime-size.yml').jobs.measure!.steps!
    const driver = sizeSteps.find(step => step.name === 'Check out frozen validation driver independently of the PR head')!
    expect(driver.if).toBeUndefined()
    expect(driver.with?.['sparse-checkout']).toContain('.node-version')
    expect(sizeSteps.find(step => step.uses === './.tmp/pr-validation-driver/.github/actions/setup-node-pnpm')!.with).toMatchObject({
      'package-json-file': 'head/package.json',
      'cache-dependency-path': 'head/pnpm-lock.yaml\nbaseline/pnpm-lock.yaml\n',
      'install-dependencies': 'false',
      'freeze-toolchain': 'false',
    })
  })

  it('allows external setup only at explicit checkout-free or upstream-owned boundaries', () => {
    const upstream = new Set(['repoctl-snapshot-build.yml', 'repoctl-snapshot-publish.yml', 'release-intent-auto.yml'])
    const reporters = new Set(['ci-pr-status.yml', 'reusable-pr-context.yml', 'ci-performance-comment.yml'])
    let pnpmReferences = 0
    for (const name of readdirSync(new URL('../.github/workflows', import.meta.url)).filter(file => file.endsWith('.yml'))) {
      for (const [jobName, job] of Object.entries(workflow(name).jobs)) {
        for (const step of job.steps ?? []) {
          if (step.uses?.startsWith('pnpm/action-setup@')) {
            pnpmReferences++
          }
          if (!step.uses?.startsWith('actions/setup-node@')) {
            continue
          }
          if (upstream.has(name) || reporters.has(name)) {
            continue
          }
          expect(`${name}/${jobName}`).toBeOneOf(['release.yml/bootstrap-publish', 'release.yml/bootstrap-verify', 'validate-ci-create-weapp-vite.yml/prepare'])
          const minimum = minVersion(String(step.with?.['node-version']))!
          expect(satisfies(minimum, engine)).toBe(true)
        }
      }
    }
    expect(pnpmReferences).toBe(0)
  })
})
