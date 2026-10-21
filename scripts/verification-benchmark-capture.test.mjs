import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { captureLocalSample } from './verificationBenchmark/capture.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verification-capture-'))
  roots.push(root)
  await mkdir(path.join(root, '.tmp'))
  await writeFile(path.join(root, '.gitignore'), '.tmp/\n')
  await writeFile(path.join(root, 'input.js'), 'export const input = 1\n')
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git(['init', '--initial-branch=main'])
  git(['add', '.'])
  git(['-c', 'user.name=Verification Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'test fixture'])
  const evidence = {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numTotalTests: 1,
    numPassedTests: 1,
    testResults: [{ name: path.join(root, 'sample.test.ts'), assertionResults: [{ fullName: 'case', status: 'passed' }] }],
  }
  const writer = `require('node:fs').writeFileSync('.tmp/tests.json', ${JSON.stringify(JSON.stringify(evidence))})`
  return {
    root,
    config: { schemaVersion: 1, id: 'baseline-1', variant: 'baseline', cachePolicy: 'warm', command: process.execPath, args: ['-e', writer], report: '.tmp/tests.json', inputFiles: ['input.js'] },
  }
}

it('captures one real child invocation and binds fresh evidence to actual host and source identity', async () => {
  const { root, config } = await fixture()
  const sample = await captureLocalSample(config, path.join(root, '.tmp/sample.json'), root)
  expect(sample).toMatchObject({ outcome: 'passed', complete: true, profile: { os: process.platform, node: process.version, runnerClass: 'local' } })
  expect(sample.metrics.executionMs).toBeGreaterThan(0)
  expect(sample.sourceFingerprint).toMatch(/^[a-f\d]{64}$/)
})

it('rejects a source mutation during execution rather than accepting its report', async () => {
  const { root, config } = await fixture()
  config.args[1] += ';require(\'node:fs\').writeFileSync(\'input.js\', \'changed\')'
  await expect(captureLocalSample(config, path.join(root, '.tmp/sample.json'), root)).rejects.toThrow(/changed during/)
})

it('does not reuse a previous successful JSON when a later command emits no evidence', async () => {
  const { root, config } = await fixture()
  await captureLocalSample(config, path.join(root, '.tmp/first.json'), root)
  const partial = await captureLocalSample({ ...config, args: ['-e', 'void 0'] }, path.join(root, '.tmp/second.json'), root)
  expect(partial).toMatchObject({ outcome: 'partial', complete: false })
})

it('rejects changes to prepared ignored artifacts that the source fingerprint cannot observe', async () => {
  const { root, config } = await fixture()
  await mkdir(path.join(root, 'packages/library/dist'), { recursive: true })
  await writeFile(path.join(root, '.git/info/exclude'), 'packages/library/dist/\n')
  await writeFile(path.join(root, 'packages/library/dist/index.mjs'), 'prepared')
  config.artifactDirectories = ['packages/library/dist']
  config.args[1] += ';require(\'node:fs\').writeFileSync(\'packages/library/dist/index.mjs\', \'changed\')'
  await expect(captureLocalSample(config, path.join(root, '.tmp/sample.json'), root)).rejects.toThrow(/prepared artifact changed/)
})
