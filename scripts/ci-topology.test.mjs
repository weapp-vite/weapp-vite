import { describe, expect, it } from 'vitest'
import { consumerContractGroups } from './consumerArtifacts/contracts.mjs'
import { readWorkflowFixture, readWorkflowGraph } from './workflowFixture.mjs'

const systems = ['ubuntu-latest', 'windows-latest', 'macos-latest']
const read = name => readWorkflowFixture(name)

describe('independent CI preparation with unchanged validation scope', () => {
  it('preserves quality matrices, lint/type coverage and all four coverage shards', () => {
    const quality = read('validate-ci.yml')
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
    expect(outer.jobs['miniapp-platform-pr'].strategy.matrix.include.map(row => [row.os, row['node-version']])).toEqual(systems.map(os => [os, 22]))
    expect(outer.jobs['miniapp-platform-full'].strategy.matrix.include).toHaveLength(6)
    const child = read('reusable-miniapp-platform.yml')
    expect(child.jobs.plan.needs).toBe('pr-context')
    expect(child.jobs.miniapp.strategy.matrix.shard).toEqual([1, 2, 3, 4])
    for (const name of ['simulator-browser', 'ide-dom-headless', 'ide-dom-acceptance-internal', 'miniapp', 'hmr', 'bun-cli']) {
      expect(child.jobs[name].needs).toContain('build')
      expect(child.jobs[name].needs.every(dependency => ['pr-context', 'build', 'plan'].includes(dependency))).toBe(true)
      expect(child.jobs[name].with.consume_build_artifact).toBe(child.jobs.build.with.build_artifact_name)
    }
    expect(child.jobs.aggregate.needs).toEqual(['pr-context', 'build', 'plan', 'miniapp'])
    expect(child.jobs.aggregate.if).toContain('!cancelled()')
    expect(child.jobs.aggregate.steps.find(step => step.name === 'Validate complete suite inventory').run).toContain('cli.ts aggregate --plan=')
    expect(child.jobs.build.with.build_artifact_name).toContain('inputs.runs_on')
    expect(child.jobs.build.with.build_artifact_name).toContain('inputs.node_version')
  })

  it('packs once per OS on Node24 and retains every consumer host, profile and supported Node version', () => {
    expect(read('validate-ci-vite-host-consumer.yml').jobs['consumer-platform'].strategy.matrix.os).toEqual(systems)
    const child = read('reusable-consumer-platform.yml')
    expect(child.jobs.prepare.with.node_version).toBe('24')
    expect(child.jobs.prepare.with.main_command).toBe('node scripts/consumerArtifacts/manifest.mjs pack .cache/node-support-tarballs')
    expect(child.jobs['node-support'].strategy.matrix.node).toEqual(['22.18.0', '24.11.0', '26.0.0', '22', '24'])
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
