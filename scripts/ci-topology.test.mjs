import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { consumerContractGroups } from './consumerArtifacts/contracts.mjs'
import { readVerificationTopologyVariant, readWorkflowFixture, readWorkflowGraph } from './workflowFixture.mjs'

const systems = ['ubuntu-latest', 'windows-latest', 'macos-latest']
const read = name => readWorkflowFixture(name)
const baseline = readVerificationTopologyVariant() === 'baseline'

describe('independent CI preparation with unchanged validation scope', () => {
  it('installs the build actual Node version in every coverage shard and merge', () => {
    const action = parse(readFileSync(new URL('../.github/actions/setup-node-pnpm/action.yml', import.meta.url), 'utf8'))
    const freeze = action.runs.steps.find(step => step.name === 'Freeze actual toolchain identity')
    expect(action.outputs['node-version'].value).toBe(`\${{ steps.toolchain.outputs.node-version }}`)
    expect(freeze.id).toBe('toolchain')
    expect(freeze.run).toMatch(/'node-version=' \+ process\.versions\.node/)
    expect(freeze.run).toContain('"$GITHUB_OUTPUT"')

    const command = read('reusable-node-command.yml')
    const setup = command.jobs.run.steps.find(step => step.uses === './.github/actions/setup-node-pnpm')
    expect(setup.id).toBe('toolchain')
    expect(command.jobs.run.outputs.node_version).toBe(`\${{ steps.toolchain.outputs.node-version }}`)
    expect(command.on.workflow_call.outputs.node_version.value).toBe(`\${{ jobs.run.outputs.node_version }}`)

    const quality = read('reusable-quality-platform.yml')
    expect(quality.jobs.build.with.node_version).toBe(`\${{ inputs.node_version }}`)
    expect(quality.jobs.coverage.with.node_version).toBe(`\${{ needs.build.outputs.node_version }}`)
    const mergeSetup = quality.jobs['coverage-merge'].steps.find(step => step.uses === './.github/actions/setup-node-pnpm')
    expect(mergeSetup.with['node-version']).toBe(`\${{ needs.build.outputs.node_version }}`)
  })

  it('preserves quality matrices, lint/type coverage and all four coverage shards', () => {
    const quality = read('validate-ci.yml')
    if (baseline) {
      const rows = quality.jobs['build-pr'].strategy.matrix.include
      expect(rows.map(row => [row.os, row['node-version']])).toEqual([
        ['ubuntu-latest', 22],
        ['ubuntu-latest', 24],
        ['windows-latest', 22],
        ['macos-latest', 22],
      ])
      expect(rows.map(row => row.main_command.trim().split('\n').slice(0, 2))).toEqual([
        ['pnpm lint', 'pnpm build:ci'],
        ['pnpm build:pkgs:ci', 'pnpm test:types'],
        ['pnpm build:ci:windows', 'pnpm test:dependency-contracts'],
        ['pnpm build:ci:macos', 'pnpm test:dependency-contracts'],
      ])
      expect(rows.every(row => row.main_command.includes('pnpm test:dependency-contracts'))).toBe(true)
      expect(rows[0].main_command).toContain('pnpm test:coverage')
      expect(rows[1].main_command).toContain('scripts/coverageShards scripts/consumerArtifacts')
      for (const name of ['build-pr', 'build-release-pr', 'build-full']) {
        expect(quality.jobs[name].uses).toBe('./.github/workflows/reusable-node-command.yml')
        expect(quality.jobs[name].with.verification_telemetry).toBe(true)
      }
      expect(quality.jobs['build-release-pr'].strategy.matrix.include).toHaveLength(2)
      expect(quality.jobs['build-full'].strategy.matrix.include).toHaveLength(6)
    }
    else {
      expect(quality.jobs['build-pr'].strategy.matrix.include.map(row => [row.os, row['node-version'], row.run_types, row.run_coverage])).toEqual([
        ['ubuntu-latest', 22, false, true],
        ['ubuntu-latest', 24, true, false],
        ['windows-latest', 22, false, false],
        ['macos-latest', 22, false, false],
      ])
      expect(quality.jobs['build-pr'].strategy.matrix.include[1].build_command).toBe('pnpm build:pkgs:ci')
      expect(quality.jobs['build-release-pr'].strategy.matrix.include).toHaveLength(2)
      expect(quality.jobs['build-full'].strategy.matrix.include).toHaveLength(6)
      for (const name of ['build-release-pr', 'build-full']) {
        expect(quality.jobs[name].strategy.matrix.include.every(row => row.run_coverage && row.lint_command)).toBe(true)
      }
    }
    const child = read('reusable-quality-platform.yml')
    expect(child.jobs.lint.needs).toBe('pr-context')
    expect(child.jobs.coverage.strategy.matrix.shard).toEqual([1, 2, 3, 4])
    for (const name of ['contracts', 'types', 'coverage']) {
      expect(child.jobs[name].needs).toEqual(['pr-context', 'build'])
      expect(child.jobs[name].with.consume_build_artifact).toBe(child.jobs.build.with.build_artifact_name)
    }
    expect(child.jobs['coverage-merge'].if).toContain('!cancelled()')
    expect(child.jobs['coverage-merge'].needs).toContain('coverage')
    expect(child.jobs['coverage-merge'].steps.filter(step => step.uses?.startsWith('codecov/'))).toHaveLength(1)
    expect(child.jobs.coverage.with).not.toHaveProperty('upload_codecov')
    expect(child.jobs.types.with.main_command).toBe('node scripts/ciTypes.mjs')
    expect(child.jobs.types.with.build_artifact_scope).toContain('mpcore/packages/simulator')
  })

  it('lets each OS consume its own build immediately and requires every planned miniapp shard', () => {
    const outer = read('validate-ci-e2e.yml')
    if (baseline) {
      expect(outer.jobs['miniapp-e2e-build-pr'].strategy.matrix.include.map(row => row.os)).toEqual(systems)
      expect(outer.jobs['miniapp-e2e-ci-pr'].strategy.matrix.include.map(row => row.os)).toEqual(systems)
      expect(outer.jobs['miniapp-e2e-ci-pr'].with.main_command).toContain('pnpm e2e:ci:pr')
      expect(outer.jobs['miniapp-e2e-build-full'].strategy.matrix.include).toHaveLength(6)
      expect(outer.jobs['miniapp-e2e-ci-full'].strategy.matrix).toEqual({ 'os': systems, 'node-version': [22, 24], 'shard': [1, 2, 3, 4] })
      for (const name of ['simulator-browser', 'ide-dom-headless', 'ide-dom-acceptance-internal', 'bun-cli']) {
        expect(outer.jobs[name].needs).toContain('miniapp-e2e-build-pr')
        expect(outer.jobs[name].needs).toContain('miniapp-e2e-build-full')
        expect(outer.jobs[name].with.consume_build_artifact).toContain('miniapp-')
      }
      expect(outer.jobs['miniapp-hmr-ci-pr'].strategy.matrix.include.map(row => row.os)).toEqual(['ubuntu-latest'])
      expect(outer.jobs['miniapp-hmr-ci-full'].strategy.matrix.include).toHaveLength(6)
    }
    else {
      expect(outer.jobs['miniapp-platform-pr'].strategy.matrix.include.map(row => [row.os, row['node-version']])).toEqual(systems.map(os => [os, 22]))
      expect(outer.jobs['miniapp-platform-full'].strategy.matrix.include).toHaveLength(6)
    }
    const child = read('reusable-miniapp-platform.yml')
    expect(child.jobs.plan.needs).toBe('pr-context')
    expect(child.jobs.miniapp.strategy.matrix.shard).toEqual([1, 2, 3, 4])
    for (const name of ['simulator-browser', 'ide-dom-headless', 'ide-dom-acceptance-internal', 'miniapp', 'hmr', 'bun-cli']) {
      expect(child.jobs[name].needs).toContain('build')
      expect(child.jobs[name].needs.every(dependency => ['pr-context', 'build', 'plan'].includes(dependency))).toBe(true)
      expect(child.jobs[name].with.consume_build_artifact).toBe(child.jobs.build.with.build_artifact_name)
    }
    expect(child.jobs['ide-dom-headless'].with.main_command).toContain('run-e2e-suite.ts ide-dom-headless')
    expect(child.jobs['ide-dom-headless'].with.checkout_ref).toBe(`\${{ needs.pr-context.outputs.checkout_sha }}`)
    expect(child.jobs['ide-dom-headless'].with.e2e_exclude_projects).toBe(`\${{ inputs.exclude_projects }}`)
    expect(child.jobs.aggregate.needs).toEqual(['pr-context', 'build', 'plan', 'miniapp'])
    expect(child.jobs.aggregate.if).toContain('!cancelled()')
    expect(child.jobs.aggregate.steps.find(step => step.name === 'Validate complete suite inventory').run).toContain('cli.ts aggregate --plan=')
    expect(child.jobs.build.with.build_artifact_name).toContain('inputs.runs_on')
    expect(child.jobs.build.with.build_artifact_name).toContain('inputs.node_version')
  })

  it('packs once per OS on Node24 and retains every consumer host, profile and supported Node version', () => {
    const consumer = read('validate-ci-vite-host-consumer.yml')
    if (baseline) {
      expect(consumer.jobs['node-support'].strategy.matrix).toEqual({ os: systems, node: ['22.23.4', '24.22.1', '26.12.1', '22', '24'] })
      expect(consumer.jobs['dependency-compatibility'].strategy.matrix).toEqual({ os: systems, manager: ['pnpm', 'npm'] })
      for (const [name, files] of Object.entries(consumerContractGroups)) {
        const job = consumer.jobs[name]
        expect(job.strategy.matrix.os).toEqual(systems)
        for (const file of files) {
          expect(job.with.main_command).toContain(file.replace('packages/weapp-vite/', ''))
        }
      }
      expect(consumer.jobs['node-support'].steps.find(step => step.name === 'Pack candidates before switching to the consumer runtime').run).toBe('node scripts/consumerArtifacts/manifest.mjs pack .cache/node-support-tarballs')
      for (const name of ['consumer', 'dependency-compatibility', ...['stateful', 'classic', 'react', 'independent', 'worker', 'plugin', 'lib', 'platform', 'web'].map(profile => `${profile}-runtime`)]) {
        expect(consumer.jobs[name].with.consumer_tarballs).toBe('.cache/node-support-tarballs')
      }
    }
    else {
      expect(consumer.jobs['consumer-platform'].strategy.matrix.os).toEqual(systems)
    }
    const child = read('reusable-consumer-platform.yml')
    expect(child.jobs.prepare.with.node_version).toBe('24')
    expect(child.jobs.prepare.with.main_command).toBe('node scripts/consumerArtifacts/manifest.mjs pack .cache/node-support-tarballs')
    expect(child.jobs['node-support'].strategy.matrix.node).toEqual(['22.23.4', '24.22.1', '26.12.1', '22', '24'])
    expect(child.jobs['dependency-compatibility'].strategy.matrix.manager).toEqual(['pnpm', 'npm'])
    expect(child.jobs.consumer.strategy.matrix.toolchain).toEqual(['wv', 'vite', 'vite-plus'])
    for (const profile of ['stateful', 'classic', 'react', 'independent', 'worker', 'plugin', 'lib', 'platform', 'web']) {
      const job = child.jobs[`${profile}-runtime`]
      expect(job.strategy.matrix.host).toEqual(['wv', 'vite', 'vite-plus'])
      expect(job.if).toBe('inputs.runs_on == \'ubuntu-latest\'')
      expect(job.with.consume_build_artifact).toBe(child.jobs.prepare.with.build_artifact_name)
      expect(job.with.consumer_tarballs).toBe('.cache/node-support-tarballs')
    }
    expect(child.jobs['classic-runtime'].strategy.matrix.profile).toEqual(['classic', 'classic-watch'])
    expect(child.jobs['classic-runtime'].strategy.matrix.exclude).toEqual([{ host: 'wv', profile: 'classic-watch' }])
    expect(Object.keys(consumerContractGroups)).toEqual(['react-host-paths', 'watch-validation', 'route-topology', 'host-paths', 'native-path-controls'])
    expect(Object.values(consumerContractGroups).flat()).toHaveLength(17)
  })

  it('verifies identical consumer provenance after either local packing or artifact restore', () => {
    const steps = read('reusable-node-command.yml').jobs.run.steps
    const pack = steps.findIndex(step => step.name === 'Pack local consumer archives with common immutable provenance')
    const verify = steps.findIndex(step => step.name === 'Verify immutable consumer archives')
    const build = steps.findIndex(step => step.uses === './.github/actions/refresh-workspace-deps')
    const restore = steps.findIndex(step => step.name === 'Download auxiliary verification artifact')
    expect(pack).toBeGreaterThan(build)
    expect(pack).toBeGreaterThan(restore)
    expect(verify).toBeGreaterThan(pack)
    expect(steps[pack].if).toBe('inputs.consumer_tarballs != \'\' && inputs.consume_aux_artifact == \'\'')
    expect(steps[verify].if).toBe('inputs.consumer_tarballs != \'\'')
    expect(steps[pack].run).toContain('scripts/consumerArtifacts/manifest.mjs pack')
    expect(steps[verify].run).toContain('scripts/consumerArtifacts/manifest.mjs verify')
    expect(steps[pack]['continue-on-error']).toBeUndefined()
    expect(steps[verify]['continue-on-error']).toBeUndefined()
  })

  it('keeps every nested candidate workflow read-only and protects cancellation evidence', () => {
    for (const workflow of readWorkflowGraph('ci-pr.yml').values()) {
      expect(Object.values(workflow.permissions ?? {}).every(permission => permission === 'read')).toBe(true)
      for (const job of Object.values(workflow.jobs)) {
        expect(Object.values(job.permissions ?? {}).every(permission => permission === 'read')).toBe(true)
        for (const step of job.steps ?? []) {
          if (step.uses?.startsWith('actions/upload-artifact@') && step.if) {
            expect(step.if).not.toContain('always()')
          }
        }
      }
    }
  })
})
