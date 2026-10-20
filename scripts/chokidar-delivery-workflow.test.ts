/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式按字面量核验。 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { readWorkflowFixture } from './workflowFixture.mjs'

interface Step {
  'name'?: string
  'uses'?: string
  'run'?: string
  'if'?: string
  'working-directory'?: string
  'continue-on-error'?: boolean
  'with'?: Record<string, unknown>
  'env'?: Record<string, string>
}

const workflow = readWorkflowFixture('ci-vite-host-consumer.yml') as {
  jobs: Record<string, {
    'if': string
    'needs': string
    'runs-on': string
    'timeout-minutes': number
    'env': Record<string, string>
    'steps': Step[]
  }>
}
const job = workflow.jobs['chokidar-delivery-windows']!
const step = (name: string) => job.steps.find(item => item.name === name)!
const source = '.cache/chokidar-delivery/original-source'
const independentStore = {
  PNPM_CONFIG_STORE_DIR: '${{ github.workspace }}/.cache/chokidar-delivery/original-store',
  PNPM_CONFIG_ENABLE_GLOBAL_VIRTUAL_STORE: 'false',
}

describe('Windows ordinary npm watcher delivery workflow', () => {
  it('freezes the candidate and original source independently on an actual Windows worker', () => {
    expect(job.if).toBe('needs.pr-context.outputs.should_run == \'true\'')
    expect(job.needs).toBe('pr-context')
    expect(job['runs-on']).toBe('windows-latest')
    expect(job['timeout-minutes']).toBe(90)
    expect(job.env.CHOKIDAR_ORIGINAL_BASELINE_SHA).toBe('80d58727ec11fccfc71f1f06edfc993e9ba264aa')
    expect(step('Check out frozen candidate').with).toEqual({ 'ref': '${{ needs.pr-context.outputs.checkout_sha }}', 'persist-credentials': false })
    expect(step('Check out original unmodified source').with).toEqual({ 'ref': '${{ env.CHOKIDAR_ORIGINAL_BASELINE_SHA }}', 'path': source, 'persist-credentials': false })
    expect(job.steps.find(item => item.uses === './.github/actions/setup-node-pnpm')?.with).toEqual({ 'node-version': '24.18.0' })
  })

  it('builds and packs the original checkout using its own lockfile, links and output', () => {
    const install = step('Install original dependency closure independently')
    expect(install['working-directory']).toBe(source)
    expect(install.run).toBe('pnpm install --frozen-lockfile')
    expect(install.env).toEqual(independentStore)
    const rebuild = step('Rebuild original dependency closure independently')
    expect(rebuild.uses).toBe('./.github/actions/refresh-workspace-deps')
    expect(rebuild.with).toEqual({ 'working-directory': source, 'build-command': 'pnpm exec turbo run build --filter=weapp-vite... --filter=rolldown-require... --force' })
    expect(rebuild.env).toEqual(independentStore)
    const pack = step('Pack original dependency closure without rewriting it')
    expect(pack['working-directory']).toBe(source)
    expect(pack.run).toBe('node packages/weapp-vite/scripts/consumerTarballs.mjs "$DELIVERY_ORIGINAL_TARBALLS"')
    expect(pack.env).toEqual({ ...independentStore, DELIVERY_ORIGINAL_TARBALLS: '${{ github.workspace }}/.cache/chokidar-delivery/original-tarballs' })
    expect(step('Record candidate archive provenance').env).toEqual({ WEAPP_VITE_DELIVERY_EXPECTED_SHA: '${{ needs.pr-context.outputs.checkout_sha }}' })
    expect(step('Record original archive provenance').env).toEqual({ WEAPP_VITE_DELIVERY_EXPECTED_SHA: '${{ env.CHOKIDAR_ORIGINAL_BASELINE_SHA }}' })
  })

  it('uses one formal lease and retains failure evidence without starting work after cancellation', () => {
    const command = step('Verify ordinary npm delivery and original negative control under the machine lease')
    expect(command.run).toBe('node --import tsx e2e/scripts/run-e2e-commands.ts node --import tsx packages/weapp-vite/scripts/chokidarDelivery/index.mjs --tarballs .cache/chokidar-delivery/candidate-tarballs --baseline-tarballs .cache/chokidar-delivery/original-tarballs --report .cache/chokidar-delivery/report.json')
    expect(job.steps.every(item => item['continue-on-error'] !== true)).toBe(true)
    const artifact = step('Preserve delivery report and independent archive provenance')
    expect(artifact.if).toBe('${{ !cancelled() }}')
    expect(artifact.with).toMatchObject({ 'name': 'chokidar-delivery-windows-${{ needs.pr-context.outputs.checkout_sha }}', 'include-hidden-files': true })
    expect(String(artifact.with?.path).trim().split('\n')).toEqual([
      '.cache/chokidar-delivery/report.json',
      '.cache/chokidar-delivery/*-provenance.json',
      '.cache/chokidar-delivery/candidate-tarballs/**',
      '.cache/chokidar-delivery/original-tarballs/**',
    ])
    expect(job.steps.at(-1)).toBe(artifact)
    expect(job.steps.slice(0, -1).every(item => item.if === undefined)).toBe(true)
  })

  it('applies the optional refresh directory to both build and injected-link installation', () => {
    const action = parse(readFileSync(new URL('../.github/actions/refresh-workspace-deps/action.yml', import.meta.url), 'utf8')) as {
      inputs: Record<string, { default?: string }>
      runs: { steps: Step[] }
    }
    expect(action.inputs['working-directory']?.default).toBe('.')
    expect(action.runs.steps).toHaveLength(2)
    expect(action.runs.steps.every(item => item['working-directory'] === '${{ inputs.working-directory }}')).toBe(true)
    for (const [index, item] of action.runs.steps.entries()) {
      const phase = index === 0 ? 'build' : 'refresh-links'
      expect(item.env?.CI_TIMING_SCRIPT).toBe('${{ github.action_path }}/../../scripts/ci-timing.mjs')
      expect(item.run?.trim().split('\n')).toEqual([
        `node "$CI_TIMING_SCRIPT" start ${phase}`,
        `trap 'phase_exit=$?; node "$CI_TIMING_SCRIPT" finish ${phase} "$phase_exit"; exit "$phase_exit"' EXIT`,
        index === 0 ? '${{ inputs.build-command }}' : 'pnpm install --frozen-lockfile --ignore-scripts',
      ])
    }
  })
})
