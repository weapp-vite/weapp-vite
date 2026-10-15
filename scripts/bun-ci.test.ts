import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { parse } from 'yaml'

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
  const workflow = parse(await readFile(path.join(ROOT, '.github/workflows/ci-e2e.yml'), 'utf8'))
  const job = workflow.jobs['bun-cli']
  expect(job.strategy.matrix).toEqual({
    'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'],
    'bun-version': ['1.4.2', 'latest'],
  })
  expect(job.needs).toEqual(['pr-context', 'miniapp-e2e-build-pr', 'miniapp-e2e-build-full', 'bun-build-diagnostic'])
  expect(job.if).toContain('needs.pr-context.outputs.should_run == \'true\'')
  expect(job.if).toContain('needs.miniapp-e2e-build-pr.result == \'success\'')
  expect(job.if).toContain('needs.miniapp-e2e-build-full.result == \'success\'')
  expect(job.if).toContain('needs.bun-build-diagnostic.result == \'success\'')
  const diagnostic = workflow.jobs['bun-build-diagnostic']
  expect(diagnostic.if).toContain('inputs.hmr-diagnostic == \'bun-cli\'')
  expect(diagnostic.strategy.matrix.include.map((row: { os: string }) => row.os)).toEqual(job.strategy.matrix.os)
  expect(diagnostic.with.build_artifact_name).toBe(job.with.consume_build_artifact)
  expect(job).not.toHaveProperty('continue-on-error')
  expect(job.with.consume_build_artifact).toBe(`miniapp-${expression('matrix.os')}-node-22-weapp-build`)
  expect(job.with.checkout_ref).toBe(expression('needs.pr-context.outputs.checkout_sha'))
  expect(job.with.bun_version).toBe(expression('matrix.bun-version'))
  expect(job.with.main_command).toContain('pnpm e2e:bun')
  expect(job.with.artifact_name).toContain('needs.pr-context.outputs.checkout_sha')
  expect(job.with.artifact_path).toContain('.tmp/bun-cli/**')
  const reusable = parse(await readFile(path.join(ROOT, '.github/workflows/reusable-node-command.yml'), 'utf8'))
  expect(reusable.on.workflow_call.inputs.bun_version.default).toBe('')
  const install = reusable.jobs.run.steps.find((step: { name?: string }) => step.name === 'Install Bun runtime')
  expect(install.if).toBe('inputs.bun_version != \'\'')
  expect(install.with['bun-version']).toBe(expression('inputs.bun_version'))
})
