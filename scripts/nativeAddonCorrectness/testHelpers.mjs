import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { baselineManifest, manifestPath } from './manifest.mjs'

export function extendedManifest() {
  const value = structuredClone(baselineManifest)
  if (!value.requiredExports.includes('analyzeNpmChunksNative')) {
    value.requiredExports.push('analyzeNpmChunksNative')
  }
  if (!value.buildFilters.includes('weapp-vite...')) {
    value.buildFilters.push('weapp-vite...')
  }
  for (const suite of [
    { file: 'test/npmChunksParity.test.ts', minimumAssertions: 13 },
    { file: 'test/npmChunkRewriteParity.test.ts', minimumAssertions: 6 },
  ]) {
    if (!value.suites.some(item => item.file === suite.file)) {
      value.suites.push(suite)
    }
  }
  return value
}

export async function candidateFixture(manifest = extendedManifest()) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-correctness-'))
  const files = [
    [manifestPath, JSON.stringify(manifest)],
    ['packages/ast-native/index.js', 'export const fixture = true\n'],
    ['packages/ast-native/fixture.node', 'fixture binary identity only; never loaded as an addon\n'],
    ['packages-runtime/wevu-compiler/package.json', '{"name":"@wevu/compiler"}'],
    ['packages/weapp-vite/package.json', '{"name":"weapp-vite"}'],
    ...manifest.suites.map(suite => [`packages/ast-native/${suite.file}`, '// correctness fixture\n']),
  ]
  for (const [file, source] of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  return { root, directory: path.join(root, '.evidence'), manifest }
}

export function completeReport(root, manifest) {
  const count = manifest.suites.reduce((sum, suite) => sum + suite.minimumAssertions, 0)
  return {
    success: true,
    numTotalTestSuites: manifest.suites.length,
    numPassedTestSuites: manifest.suites.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: manifest.suites.map(suite => ({
      name: path.join(root, 'packages/ast-native', suite.file),
      status: 'passed',
      assertionResults: Array.from({ length: suite.minimumAssertions }, () => ({ status: 'passed', failureMessages: [] })),
    })),
  }
}
