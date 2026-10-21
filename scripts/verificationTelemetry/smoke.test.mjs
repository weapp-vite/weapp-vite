import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 验证真实原命令与 reporter 生命周期，不启动任何 E2E 或浏览器。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { finalizeBaselineCoverage, readJson } from './coverage.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const roots = []
const env = { WEAPP_VITE_VERIFICATION_TELEMETRY: '1', BUILD_ARTIFACT_EXPECTED_COMMIT: 'a'.repeat(40) }

afterEach(async () => {
  await Promise.all(roots.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

async function fixture(extraSource = '') {
  await fs.mkdir(path.join(root, '.tmp'), { recursive: true })
  const directory = await fs.mkdtemp(path.join(root, '.tmp/coverage-telemetry-smoke-'))
  roots.push(directory)
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: { 'test:coverage': 'vitest run --configLoader bundle --coverage.enabled --exclude \'**/.codex-tmp/**\'' } }))
  await fs.writeFile(path.join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  await fs.writeFile(path.join(directory, 'vitest.coverage.ts'), 'export const originalThreshold = 100\n')
  const helper = new URL('./vitest.mjs', import.meta.url).href
  await fs.writeFile(path.join(directory, 'vitest.config.mts'), `import { baselineVitestTelemetry } from ${JSON.stringify(helper)}\nexport default { test: { ...baselineVitestTelemetry(${JSON.stringify(directory)}), include: ['math.test.js'], coverage: { include: ['math.js'], thresholds: { functions: 100 } } } }\n`)
  await fs.writeFile(path.join(directory, 'math.js'), `export const double = value => value * 2\n${extraSource}`)
  await fs.writeFile(path.join(directory, 'math.test.js'), 'import { it, expect } from \'vitest\'\nimport { double } from \'./math.js\'\nit(\'doubles\', () => expect(double(2)).toBe(4))\n')
  return { directory, output: path.join(directory, '.tmp/verification-telemetry/coverage') }
}

it('records real native Vitest blob, actual cases and the successful unchanged threshold command', async () => {
  const { directory, output } = await fixture()
  const result = await execa('pnpm', ['test:coverage'], { cwd: directory, env, reject: false })
  expect(result.exitCode, result.all ?? result.stdout + result.stderr).toBe(0)
  const observed = await readJson(path.join(output, 'observed.json'))
  expect(observed.cases.map(item => [item.file, item.name, item.state])).toEqual([['math.test.js', 'doubles', 'passed']])
  expect((await fs.stat(path.join(output, 'blob.json'))).size).toBeGreaterThan(0)
  await finalizeBaselineCoverage(directory, output, { commandSucceeded: true, identity: (await readJson(path.join(output, 'plan.json'))).identity })
  expect((await readJson(path.join(output, 'shard-verdict.json'))).status).toBe('passed')
}, 30_000)

it('keeps a real threshold failure failed after all test cases have passed', async () => {
  const { directory, output } = await fixture('export const unused = () => 1\n')
  const result = await execa('pnpm', ['test:coverage'], { cwd: directory, env, reject: false })
  expect(result.exitCode).not.toBe(0)
  expect((await readJson(path.join(output, 'observed.json'))).passed).toBe(true)
  expect(result.stdout + result.stderr).toMatch(/threshold/iu)
  await expect(fs.access(path.join(output, 'shard-verdict.json'))).rejects.toMatchObject({ code: 'ENOENT' })
}, 30_000)
