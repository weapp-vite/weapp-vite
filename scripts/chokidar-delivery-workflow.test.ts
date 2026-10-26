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

const expandedConsumerJobs = [
  'node-support',
  'dependency-compatibility',
  'react-host-paths',
  'watch-validation',
  'route-topology',
  'host-paths',
  'native-path-controls',
  'consumer',
  'stateful-runtime',
  'classic-runtime',
  'react-runtime',
  'independent-runtime',
  'worker-runtime',
  'plugin-runtime',
  'lib-runtime',
  'platform-runtime',
  'web-runtime',
]

describe('Windows ordinary npm watcher delivery workflow', () => {
  it('keeps full validation as the default and isolates an explicit trace-only dispatch', () => {
    const entry = parse(readFileSync(new URL('../.github/workflows/ci-vite-host-consumer.yml', import.meta.url), 'utf8'))
    const reusable = parse(readFileSync(new URL('../.github/workflows/validate-ci-vite-host-consumer.yml', import.meta.url), 'utf8'))
    const native = parse(readFileSync(new URL('../.github/workflows/ci-pr.yml', import.meta.url), 'utf8'))
    expect(entry.on.workflow_dispatch.inputs['chokidar-delivery-diagnostic']).toMatchObject({ required: false, default: false, type: 'boolean' })
    expect(entry.jobs.validation.with.chokidar_delivery_diagnostic).toBe('${{ inputs.chokidar-delivery-diagnostic || false }}')
    expect(reusable.on.workflow_call.inputs.chokidar_delivery_diagnostic).toEqual({ required: false, type: 'boolean', default: false })
    expect(native.jobs['ci-vite-host-consumer'].with).toEqual({ pr_context: '${{ needs.plan.outputs.pr_context }}' })
    const validationJobs = Object.entries(reusable.jobs).filter(([name]) => name !== 'pr-context')
    const platform = reusable.jobs['consumer-platform']
    expect(validationJobs.map(([name]) => name).sort()).toEqual((platform
      ? ['chokidar-delivery-windows', 'consumer-platform']
      : ['chokidar-delivery-windows', ...expandedConsumerJobs]).sort())
    for (const [name, value] of validationJobs) {
      const candidate = value as { if: string }
      expect(candidate.if).toBe(name === 'chokidar-delivery-windows'
        ? 'needs.pr-context.outputs.should_run == \'true\''
        : 'needs.pr-context.outputs.should_run == \'true\' && !inputs.chokidar_delivery_diagnostic')
    }
    if (platform) {
      expect(platform).toMatchObject({
        needs: 'pr-context',
        uses: './.github/workflows/reusable-consumer-platform.yml',
        with: { pr_context: '${{ inputs.pr_context }}', runs_on: '${{ matrix.os }}' },
        secrets: 'inherit',
      })
      expect(platform.strategy.matrix).toEqual({ os: ['ubuntu-latest', 'windows-latest', 'macos-latest'] })
    }
    expect(step('Verify ordinary npm delivery and original negative control under the machine lease').env).toEqual({
      WEAPP_VITE_DELIVERY_TRACE: '${{ inputs.chokidar_delivery_diagnostic && \'1\' || \'0\' }}',
    })
  })

  it('maps every expanded workload to the complete aggregate consumer graph', async () => {
    const reusable = parse(readFileSync(new URL('../.github/workflows/validate-ci-vite-host-consumer.yml', import.meta.url), 'utf8'))
    const child = parse(readFileSync(new URL('../.github/workflows/reusable-consumer-platform.yml', import.meta.url), 'utf8'))
    const { consumerContractGroups } = await import(new URL('./consumerArtifacts/contracts.mjs', import.meta.url).href) as { consumerContractGroups: Record<string, string[]> }
    expect(consumerContractGroups).toEqual({
      'react-host-paths': ['packages/weapp-vite/test/vite-react.test.ts'],
      'watch-validation': ['packages/weapp-vite/test/vite-watch-validation.test.ts', 'packages/weapp-vite/test/vite-watch.test.ts', 'packages/weapp-vite/test/vite-worker.test.ts', 'packages/weapp-vite/test/wxml-transform-watch.test.ts', 'packages/weapp-vite/src/vite/session.test.ts', 'packages/weapp-vite/src/runtime/buildPlugin/workers.test.ts'],
      'route-topology': ['packages/weapp-vite/src/plugins/core/lifecycle/autoRoutesTopology.test.ts', 'packages/weapp-vite/src/plugins/core/lifecycle/watch.test.ts', 'packages/weapp-vite/test/vite-watch.test.ts'],
      'host-paths': ['packages/weapp-vite/src/runtime/libDts.test.ts', 'packages/weapp-vite/src/runtime/compilerSession/session.test.ts', 'packages/weapp-vite/test/vite-lib.test.ts'],
      'native-path-controls': ['packages/weapp-vite/test/vite-native-path-controls.test.ts', 'packages/weapp-vite/test/vite-native-watch-topology.test.ts', 'packages/weapp-vite/src/plugins/tailwindcss/contentInvalidation.test.ts', 'packages/weapp-vite/src/runtime/statefulHmr/snapshotAssetInputs.test.ts'],
    })
    const runtimeProfiles = ['stateful', 'classic', 'react', 'independent', 'worker', 'plugin', 'lib', 'platform', 'web']
    const runtimeJobs = runtimeProfiles.map(profile => `${profile}-runtime`)
    expect([...Object.keys(consumerContractGroups), 'node-support', 'dependency-compatibility', 'consumer', ...runtimeJobs].sort()).toEqual([...expandedConsumerJobs].sort())
    if (!reusable.jobs['consumer-platform']) {
      for (const [name, files] of Object.entries(consumerContractGroups)) {
        const expanded = reusable.jobs[name]
        expect(expanded.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest', 'macos-latest'])
        expect(expanded.with.checkout_ref).toBe('${{ needs.pr-context.outputs.checkout_sha }}')
        for (const file of files) {
          expect(expanded.with.main_command).toContain(file.replace('packages/weapp-vite/', ''))
        }
      }
      expect(reusable.jobs['node-support'].strategy.matrix.node).toEqual(['22.23.4', '24.22.1', '26.12.1', '22', '24'])
      expect(reusable.jobs['node-support'].steps.find((item: Step) => item.name === 'Verify immutable locally built consumer archives').run).toBe('node scripts/consumerArtifacts/manifest.mjs verify .cache/node-support-tarballs')
      for (const name of runtimeJobs) {
        const expanded = reusable.jobs[name]
        expect(expanded.with.runs_on).toBe('ubuntu-latest')
        expect(expanded.strategy.matrix.host).toEqual(['wv', 'vite', 'vite-plus'])
        expect(expanded.with.consumer_tarballs).toBe('.cache/node-support-tarballs')
      }
      expect(reusable.jobs['classic-runtime'].strategy.matrix.exclude).toEqual([{ host: 'wv', profile: 'classic-watch' }])
    }
    expect(Object.keys(child.jobs).sort()).toEqual(['pr-context', 'prepare', 'node-support', 'contracts', 'dependency-compatibility', 'consumer', ...runtimeJobs].sort())
    expect(child.jobs['pr-context']).toMatchObject({
      uses: './.github/workflows/reusable-frozen-pr-context.yml',
      with: { pr_context: '${{ inputs.pr_context }}', profile: 'ci-vite-host-consumer' },
    })
    const build = 'consumer-${{ inputs.runs_on }}-node-24-build'
    const archives = 'consumer-tarballs-${{ inputs.runs_on }}'
    const prepare = child.jobs.prepare
    expect(prepare.if).toBeUndefined()
    expect(prepare.needs).toBe('pr-context')
    expect(prepare.uses).toBe('./.github/workflows/reusable-node-command.yml')
    expect(prepare.with).toMatchObject({
      checkout_ref: '${{ needs.pr-context.outputs.checkout_sha }}',
      base_sha: '${{ needs.pr-context.outputs.base_sha }}',
      head_sha: '${{ needs.pr-context.outputs.head_sha }}',
      pr_number: '${{ needs.pr-context.outputs.pr_number }}',
      head_ref: '${{ needs.pr-context.outputs.head_ref }}',
      base_ref: '${{ needs.pr-context.outputs.base_ref }}',
      node_version: '24',
      runs_on: '${{ inputs.runs_on }}',
      build_command: 'pnpm exec turbo run build --filter=weapp-vite... --filter=@weapp-vite/react... --filter=rolldown-require... --filter=@mpcore/simulator...',
      main_command: 'node scripts/consumerArtifacts/manifest.mjs pack .cache/node-support-tarballs',
      build_artifact_name: build,
      artifact_name: archives,
      artifact_path: '.cache/node-support-tarballs',
    })
    const nodeSupport = child.jobs['node-support']
    expect(nodeSupport.strategy.matrix).toEqual({ node: ['22.23.4', '24.22.1', '26.12.1', '22', '24'] })
    expect(nodeSupport['runs-on']).toBe('${{ inputs.runs_on }}')
    expect(nodeSupport.env).toMatchObject({ BUILD_ARTIFACT_EXPECTED_COMMIT: '${{ needs.pr-context.outputs.checkout_sha }}', BUILD_ARTIFACT_EXPECTED_NODE_MAJOR: '24', WEAPP_VITE_CONSUMER_TARBALLS: '.cache/node-support-tarballs' })
    expect(nodeSupport.steps.find((item: Step) => item.uses?.startsWith('actions/setup-node@'))?.with).toEqual({
      'node-version': '${{ matrix.node == \'22\' && \'^22.23.4\' || matrix.node == \'24\' && \'^24.22.1\' || matrix.node == \'26\' && \'^26.12.1\' || matrix.node }}',
      'check-latest': '${{ matrix.node == \'22\' || matrix.node == \'24\' || matrix.node == \'26\' }}',
    })
    expect(nodeSupport.steps.find((item: Step) => item.uses?.startsWith('actions/checkout@'))?.with).toMatchObject({ 'ref': '${{ needs.pr-context.outputs.checkout_sha }}', 'persist-credentials': false })
    expect(nodeSupport.steps.filter((item: Step) => item.uses?.startsWith('actions/download-artifact@')).map((item: Step) => item.with?.name)).toEqual([build, archives])
    expect(nodeSupport.steps.find((item: Step) => item.name === 'Verify immutable candidate archives')?.run).toBe('node scripts/consumerArtifacts/manifest.mjs verify .cache/node-support-tarballs')
    expect(nodeSupport.steps.find((item: Step) => item.name === 'Verify packed Dashboard public types without mini-program ambient globals')?.run).toBe('node packages/weapp-vite/scripts/verify-dashboard-public-types.mjs')
    expect(nodeSupport.steps.find((item: Step) => item.name === 'Install and verify published native, SFC, Tailwind and Web consumers')).toMatchObject({
      run: 'node packages/weapp-vite/scripts/verify-vite-host-install.mjs wv',
      env: { WEAPP_VITE_CONSUMER_WEB: '1', WEAPP_VITE_CONSUMER_DEPENDENCIES: '1', WEAPP_VITE_CONSUMER_TARBALLS: '.cache/node-support-tarballs' },
    })
    expect(nodeSupport['timeout-minutes']).toBe(40)
    const browserInstalls = (nodeSupport.steps as Step[]).filter(item => item.run?.includes('playwright install'))
    expect(browserInstalls).toHaveLength(2)
    const linuxBrowser = browserInstalls.find(item => item.if === 'runner.os == \'Linux\'')
    const otherBrowser = browserInstalls.find(item => item.if === 'runner.os != \'Linux\'')
    expect(linuxBrowser?.run?.trim().split('\n').at(-1)).toBe('pnpm exec playwright install --with-deps chromium')
    expect(otherBrowser?.run).toBe('pnpm exec playwright install chromium')
    expect(browserInstalls.every(item => item['continue-on-error'] !== true)).toBe(true)
    expect(Object.keys(nodeSupport.env)).not.toContain('PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS')
    expect(child.jobs['dependency-compatibility'].strategy.matrix).toEqual({ manager: ['pnpm', 'npm'] })
    expect(child.jobs['dependency-compatibility'].with.main_command).toBe('pnpm exec cross-env WEAPP_VITE_DEPENDENCY_EVIDENCE=.cache/dependency-compatibility.json node packages/weapp-vite/scripts/verify-dependency-install.mjs ${{ matrix.manager }}')
    expect(child.jobs.contracts.with.main_command).toBe('node scripts/consumerArtifacts/contracts.mjs')
    expect(child.jobs.consumer.strategy.matrix).toEqual({ toolchain: ['wv', 'vite', 'vite-plus'] })
    expect(child.jobs.consumer.with.main_command).toBe('node packages/weapp-vite/scripts/verify-vite-host-install.mjs ${{ matrix.toolchain }}')
    for (const [name, value] of Object.entries(child.jobs)) {
      const candidate = value as { if?: string, needs: string[], uses: string, with: Record<string, unknown> }
      if (name === 'pr-context' || name === 'prepare') {
        continue
      }
      expect(candidate.needs).toEqual(['pr-context', 'prepare'])
      expect(candidate.if).toBe(['node-support', 'contracts', 'dependency-compatibility'].includes(name) ? undefined : 'inputs.runs_on == \'ubuntu-latest\'')
      if (name !== 'node-support') {
        expect(candidate.uses).toBe('./.github/workflows/reusable-node-command.yml')
        expect(candidate.with).toMatchObject({
          checkout_ref: '${{ needs.pr-context.outputs.checkout_sha }}',
          base_sha: '${{ needs.pr-context.outputs.base_sha }}',
          head_sha: '${{ needs.pr-context.outputs.head_sha }}',
          pr_number: '${{ needs.pr-context.outputs.pr_number }}',
          head_ref: '${{ needs.pr-context.outputs.head_ref }}',
          base_ref: '${{ needs.pr-context.outputs.base_ref }}',
          runs_on: '${{ inputs.runs_on }}',
          node_version: '24',
          consume_build_artifact: build,
          build_artifact_node_major: '24',
          consume_aux_artifact: archives,
          aux_artifact_path: '.cache/node-support-tarballs',
          consumer_tarballs: '.cache/node-support-tarballs',
        })
      }
    }
    for (const profile of runtimeProfiles) {
      const runtime = child.jobs[`${profile}-runtime`]
      expect(runtime.strategy.matrix).toEqual(profile === 'classic'
        ? { host: ['wv', 'vite', 'vite-plus'], profile: ['classic', 'classic-watch'], exclude: [{ host: 'wv', profile: 'classic-watch' }] }
        : { host: ['wv', 'vite', 'vite-plus'] })
      if (profile === 'web') {
        expect(runtime.with).toMatchObject({ install_playwright: true, playwright_browsers: 'chromium', artifact_path: '.cache/web-consumer-diagnostic/host-capability-*.json' })
        expect(runtime.with.main_command.trim().split('\n')).toEqual([
          'pnpm exec vitest run --config scripts/vitest.config.mjs scripts/hostCapabilityDiagnostic.test.mjs',
          'pnpm exec cross-env WEAPP_VITE_CONSUMER_HOST_DIAGNOSTICS=1 node packages/weapp-vite/scripts/verify-vite-host-install.mjs ${{ matrix.host }} headless web',
        ])
      }
      else {
        expect(runtime.with.main_command).toBe(`node packages/weapp-vite/scripts/verify-vite-host-install.mjs \${{ matrix.host }} headless ${profile === 'classic' ? '${{ matrix.profile }}' : profile}`)
      }
    }
  })

  it('freezes the candidate and original source independently on an actual Windows worker', () => {
    expect(job.if).toBe('needs.pr-context.outputs.should_run == \'true\'')
    expect(job.needs).toBe('pr-context')
    expect(job['runs-on']).toBe('windows-latest')
    expect(job['timeout-minutes']).toBe(90)
    expect(job.env.CHOKIDAR_ORIGINAL_BASELINE_SHA).toBe('80d58727ec11fccfc71f1f06edfc993e9ba264aa')
    expect(step('Check out frozen candidate').with).toEqual({ 'ref': '${{ needs.pr-context.outputs.checkout_sha }}', 'persist-credentials': false })
    expect(step('Check out original unmodified source').with).toEqual({ 'ref': '${{ env.CHOKIDAR_ORIGINAL_BASELINE_SHA }}', 'path': source, 'persist-credentials': false })
    expect(job.steps.find(item => item.uses === './.github/actions/setup-node-pnpm')?.with).toEqual({ 'node-version': '24.22.1' })
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
