import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createJiti } from 'jiti'
import { expect, it } from 'vitest'
import { readWorkflowFixture } from './workflowFixture.mjs'

interface Step {
  'name'?: string
  'run'?: string
  'uses'?: string
  'if'?: string
  'timeout-minutes'?: number
  'env'?: Record<string, string>
  'with'?: Record<string, unknown>
}

interface Job {
  'needs'?: string
  'if'?: string
  'concurrency'?: unknown
  'continue-on-error'?: boolean
  'permissions'?: Record<string, string>
  'steps'?: Step[]
}

function expression(value: string) {
  return '$' + `{{ ${value} }}`
}

const workflow = readWorkflowFixture('release.yml') as { jobs: Record<string, Job> }
const mirror = workflow.jobs.mirror!
const steps = mirror.steps!
const sync = steps.find(step => step.name === 'Sync only the confirmed publication')!
const retry = steps.find(step => step.name === 'Record mirror retry instructions')!

it('isolates mirror synchronization from completion, npm serialization and documentation deployment', async () => {
  expect(mirror.needs).toBe('release')
  expect(mirror.if).toContain('needs.release.outputs.release-record != \'\'')
  expect(mirror['continue-on-error']).toBe(true)
  expect(mirror.permissions).toEqual({ contents: 'read', actions: 'read' })
  expect(mirror.concurrency).toBeUndefined()
  expect(workflow.jobs.docs?.needs).toBe('release')
  expect(workflow.jobs.nightly?.needs).toBeUndefined()
  const config = await createJiti(import.meta.url).import<typeof import('../repoctl.config').default>('../repoctl.config.ts', { default: true })
  expect(config.commands.release.hooks.afterPublish).toEqual([{ script: 'release:vscode-marketplace' }])
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }
  expect(manifest.scripts['release:sync-npmmirror']).toBe('repo release sync-npmmirror --published --timeout 240')
  expect(sync['timeout-minutes']).toBe(5)
})

it('downloads only this attempt and never scans workspace versions as a fallback', () => {
  const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'))!
  expect(checkout.with).toEqual({ 'ref': expression('github.sha'), 'persist-credentials': false })
  const download = steps.find(step => step.uses?.startsWith('actions/download-artifact@'))!
  expect(download.with).toEqual({
    name: `npm-publish-progress-${expression('github.run_id')}-${expression('github.run_attempt')}`,
    path: `${expression('runner.temp')}/confirmed-release`,
  })
  expect(sync.env).toEqual({ REPO_RELEASE_PUBLISH_SUMMARY: `${expression('runner.temp')}/confirmed-release/pnpm-publish-summary.json` })
  expect(retry.if).toContain('failure()')
  expect(retry.run).toContain('REPO_RELEASE_PUBLISH_SUMMARY=<downloaded-summary> pnpm release:sync-npmmirror')
  expect(retry.run).not.toContain('release ci')
})

it.skipIf(process.platform === 'win32')('preserves the exact summary and retry instructions when synchronization times out', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'release-mirror-timeout-'))
  try {
    const summary = path.join(directory, 'pnpm-publish-summary.json')
    const stepSummary = path.join(directory, 'summary.md')
    const trace = path.join(directory, 'invocation')
    const published = JSON.stringify({ publishedPackages: [{ name: '@fixture/confirmed', version: '1.2.3' }] })
    await writeFile(summary, published)
    await writeFile(path.join(directory, 'pnpm'), '#!/bin/sh\nprintf "%s" "$REPO_RELEASE_PUBLISH_SUMMARY" > "$FIXTURE_TRACE"\nexit 124\n', { mode: 0o755 })
    const env = { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, REPO_RELEASE_PUBLISH_SUMMARY: summary, GITHUB_STEP_SUMMARY: stepSummary, FIXTURE_TRACE: trace }
    expect(spawnSync('bash', ['-euc', sync.run!], { env }).status).toBe(124)
    expect(await readFile(trace, 'utf8')).toBe(summary)
    expect(await readFile(summary, 'utf8')).toBe(published)
    const warning = spawnSync('bash', ['-euc', retry.run!.replaceAll(expression('github.run_id'), '123').replaceAll(expression('github.run_attempt'), '2')], { env, encoding: 'utf8' })
    expect(warning.status).toBe(0)
    expect(warning.stdout).toContain('::warning::')
    expect(await readFile(stepSummary, 'utf8')).toContain('npm-publish-progress-123-2')
    await rm(summary)
    await rm(trace)
    expect(spawnSync('bash', ['-euc', sync.run!], { env }).status).not.toBe(0)
    await expect(readFile(trace)).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
