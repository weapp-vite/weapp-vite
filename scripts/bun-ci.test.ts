import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { frozenJobCondition, frozenWorkflowText, readVerificationTopologyVariant, readWorkflowFixture } from './workflowFixture.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const expression = (value: string) => `$${'{{'} ${value} }}`

it('normalizes Bun test globs for Windows test discovery', async () => {
  vi.doMock('node:path', () => ({
    default: { ...path, resolve: (...parts: string[]) => path.win32.resolve('C:/workspace', ...parts) },
  }))
  try {
    const { default: config } = await import('../e2e/vitest.e2e.bun.config')
    expect(config.test?.include).toHaveLength(2)
    expect(config.test?.include?.every(pattern => !pattern.includes('\\'))).toBe(true)
    expect(config.test?.include?.map(pattern => pattern.split('/').at(-1))).toEqual(['cli.test.ts', 'ipc.test.ts'])
  }
  finally {
    vi.doUnmock('node:path')
  }
})

it('runs Bun CLI on all three systems against frozen workspace artifacts', async () => {
  const workflow = readWorkflowFixture('ci-e2e.yml')
  const job = workflow.jobs['bun-cli']
  expect(job.strategy.matrix).toEqual({
    'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'],
    'bun-version': ['1.4.2', 'latest'],
  })
  const baseline = readVerificationTopologyVariant() === 'baseline'
  expect(job.needs).toEqual(baseline ? ['pr-context', 'miniapp-e2e-build-pr', 'miniapp-e2e-build-full', 'bun-build-diagnostic'] : ['pr-context', 'bun-build-diagnostic'])
  expect(job.if).toContain(frozenWorkflowText('needs.pr-context.outputs.should_run == \'true\'', 'ci-e2e'))
  expect(job.if).toContain('needs.bun-build-diagnostic.result == \'success\'')
  const diagnostic = workflow.jobs['bun-build-diagnostic']
  expect(diagnostic.if).toContain('inputs.hmr-diagnostic == \'bun-cli\'')
  expect(diagnostic.strategy.matrix.include.map((row: { os: string }) => row.os)).toEqual(job.strategy.matrix.os)
  expect(diagnostic.with.build_artifact_name).toBe(job.with.consume_build_artifact)
  expect(job).not.toHaveProperty('continue-on-error')
  expect(job.with.consume_build_artifact).toBe(`miniapp-${expression('matrix.os')}-node-22-weapp-build`)
  expect(job.with.checkout_ref).toBe(frozenWorkflowText(expression('needs.pr-context.outputs.checkout_sha'), 'ci-e2e'))
  expect(job.with.bun_version).toBe(expression('matrix.bun-version'))
  expect(job.with.main_command).toContain('pnpm e2e:bun')
  expect(job.with.artifact_name).toContain('needs.pr-context.outputs.checkout_sha')
  expect(job.with.artifact_path).toContain('.tmp/bun-cli/**')
  const platform = readWorkflowFixture('reusable-miniapp-platform.yml')
  const standard = platform.jobs['bun-cli']
  expect(standard.if).toBe(frozenJobCondition('inputs.node_version == \'22\'', 'ci-e2e', ['pr-context', 'build']))
  expect(standard.needs).toEqual(['pr-context', 'build'])
  expect(standard.strategy.matrix).toEqual({ 'bun-version': ['1.4.2', 'latest'] })
  expect(standard.with.consume_build_artifact).toBe(platform.jobs.build.with.build_artifact_name)
  expect(standard.with.main_command).toContain('pnpm e2e:bun')
  for (const name of baseline ? ['miniapp-e2e-build-pr', 'miniapp-e2e-build-full'] : ['miniapp-platform-pr', 'miniapp-platform-full']) {
    const platforms = workflow.jobs[name].strategy.matrix.include
    expect(platforms.filter((row: { 'node-version'?: number }) => (row['node-version'] ?? 22) === 22).map((row: { os: string }) => row.os)).toEqual(job.strategy.matrix.os)
  }
  const reusable = parse(await readFile(path.join(ROOT, '.github/workflows/reusable-node-command.yml'), 'utf8'))
  expect(reusable.on.workflow_call.inputs.bun_version.default).toBe('')
  const install = reusable.jobs.run.steps.find((step: { name?: string }) => step.name === 'Install Bun runtime')
  expect(install.if).toBe('inputs.bun_version != \'\'')
  expect(install.with['bun-version']).toBe(expression('inputs.bun_version'))
})
