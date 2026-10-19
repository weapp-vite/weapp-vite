import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createBuildArtifactManifest, verifyBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { createCoveragePlan, mergeCoverageShards, runCoverageShard } from './index.mjs'

it.each([true, false])('merges four real Vitest shards without re-executing tests and keeps original thresholds: covered=%s', async (fullyCovered) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'coverage-shards-'))
  const previousCommit = process.env.BUILD_ARTIFACT_EXPECTED_COMMIT
  process.env.BUILD_ARTIFACT_EXPECTED_COMMIT = 'a'.repeat(40)
  try {
    await symlink(fileURLToPath(new URL('../../node_modules', import.meta.url)), path.join(root, 'node_modules'), 'junction')
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', packageManager: JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).packageManager }))
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
    await writeFile(path.join(root, 'vitest.coverage.ts'), 'export {}\n')
    await writeFile(path.join(root, 'vitest.config.mts'), `export default { test: { include: ['*.test.mjs'], maxWorkers: 1, coverage: { provider: 'v8', include: ['source.mjs'], thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 } } } }\n`)
    await writeFile(path.join(root, 'source.mjs'), 'export const choose = value => value ? 1 : 2\n')
    for (let index = 0; index < 4; index++) {
      const value = fullyCovered ? index % 2 === 0 : true
      await writeFile(path.join(root, `case-${index}.test.mjs`), `import { it, expect } from 'vitest'; import { appendFileSync } from 'node:fs'; import { choose } from './source.mjs'; it('branch', () => { appendFileSync('executions.txt', '${index}\\n'); expect(choose(${value})).toBe(${value ? 1 : 2}); });\n`)
    }
    const plan = path.join(root, '.tmp/plan/plan.json')
    const reports = path.join(root, '.tmp/reports')
    await mkdir(reports, { recursive: true })
    const frozen = await createCoveragePlan(root, plan, 4)
    for (let index = 1; index <= 4; index++) {
      const directory = path.join(reports, `shard-${index}`)
      const report = await runCoverageShard(root, plan, index, directory)
      expect(report.cases).toHaveLength(1)
      expect(report.cases[0]).toMatchObject({ name: 'branch', state: 'passed' })
      await rm(path.join(directory, 'coverage'), { recursive: true, force: true })
      await rm(path.join(directory, 'observed.json'))
    }
    const before = await readFile(path.join(root, 'executions.txt'), 'utf8')
    expect(before.trim().split('\n').sort()).toEqual(['0', '1', '2', '3'])
    if (fullyCovered) {
      await mergeCoverageShards(root, plan, reports, path.join(root, 'coverage'))
      const scope = JSON.parse(await readFile(path.join(root, 'coverage/logical-scope.json'), 'utf8'))
      expect(scope.files).toHaveLength(4)
      expect(scope.cases).toHaveLength(4)
    }
    else {
      await mkdir(path.join(root, 'coverage'), { recursive: true })
      await writeFile(path.join(root, 'coverage/shard-verdict.json'), '{"status":"passed"}')
      await writeFile(path.join(root, 'coverage/logical-scope.json'), '{"cases":["previous-run"]}')
      await expect(mergeCoverageShards(root, plan, reports, path.join(root, 'coverage'))).rejects.toThrow('Command failed')
      await expect(readFile(path.join(root, 'coverage/shard-verdict.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readFile(path.join(root, 'coverage/logical-scope.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    expect(await readFile(path.join(root, 'executions.txt'), 'utf8')).toBe(before)
    const coverage = JSON.parse(await readFile(path.join(root, 'coverage/coverage-summary.json'), 'utf8'))
    expect(coverage.total.branches.pct).toBe(fullyCovered ? 100 : 50)
    await build({ root, configFile: false, logLevel: 'silent', build: { lib: { entry: path.join(root, 'source.mjs'), formats: ['es'] }, outDir: 'packages/fixture/dist', minify: false } })
    const artifactEnv = { BUILD_ARTIFACT_EXPECTED_COMMIT: frozen.identity.commit, BUILD_ARTIFACT_PACKAGE_MANAGER: frozen.identity.packageManager }
    const artifact = createBuildArtifactManifest(root, artifactEnv)
    expect(artifact.schemaVersion).toBe(2)
    expect(artifact.toolchain.actualPackageManager).toBe(frozen.identity.packageManager)
    expect(verifyBuildArtifactManifest(root, artifact, artifactEnv)).toBe(artifact)
  }
  finally {
    if (previousCommit === undefined) {
      delete process.env.BUILD_ARTIFACT_EXPECTED_COMMIT
    }
    else {
      process.env.BUILD_ARTIFACT_EXPECTED_COMMIT = previousCommit
    }
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
