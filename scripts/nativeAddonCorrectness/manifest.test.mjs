import { readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyNativeExports, verifyNativeReport } from './gate.mjs'
import { baselineManifest, loadManifest, manifestPath, validateManifest } from './manifest.mjs'
import { candidateFixture, completeReport, extendedManifest } from './testHelpers.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('candidate native correctness manifest', () => {
  it('supports all three restored coverage increments without changing the driver baseline', () => {
    const before = structuredClone(baselineManifest)
    const reserved = structuredClone(before)
    reserved.suites.push({ file: 'test/reservedPropsParity.test.ts', minimumAssertions: 27 })
    const defaultExport = structuredClone(reserved)
    defaultExport.suites.push({ file: 'test/defaultExportParity.test.ts', minimumAssertions: 13 })
    expect([reserved, defaultExport, extendedManifest()].map(value =>
      validateManifest(value).suites.reduce((count, suite) => count + suite.minimumAssertions, 0),
    )).toEqual([122, 135, 114])
    expect(baselineManifest).toEqual(before)
  })

  it.each(['test/reservedPropsParity.test.ts', 'test/defaultExportParity.test.ts'])('rejects omitted or partial candidate-only %s', (file) => {
    const coverage = structuredClone(baselineManifest)
    coverage.suites.push({ file, minimumAssertions: file.includes('reservedProps') ? 27 : 13 })
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    report.testResults.pop()
    const count = baselineManifest.suites.reduce((sum, suite) => sum + suite.minimumAssertions, 0)
    report.numTotalTests = report.numPassedTests = count
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow('omits suites')
    const partial = completeReport(root, coverage)
    partial.testResults.at(-1).assertionResults.pop()
    partial.numTotalTests--
    partial.numPassedTests--
    expect(() => verifyNativeReport(partial, path.join(root, 'packages/ast-native'), coverage)).toThrow('partial')
  })

  it.each([
    value => value.schemaVersion = 2,
    value => value.shell = 'pnpm test',
    value => value.requiredExports.pop(),
    value => value.requiredExports.push('analyzeCompilerScriptsNative'),
    value => value.requiredExports.push('--require=inject'),
    value => value.buildFilters = ['weapp-vite...'],
    value => value.buildFilters.push('*'),
    value => value.buildFilters.push('weapp-vite... --concurrency=8'),
    value => value.buildFilters.push('@wevu/compiler...'),
    value => value.suites.pop(),
    value => value.suites[0].minimumAssertions--,
    value => value.suites[0].minimumAssertions = 1.5,
    value => value.suites[0].minimumAssertions = 0,
    value => value.suites[0].file = '../outside.test.ts',
    value => value.suites[0].file = 'test/../../outside.test.ts',
    value => value.suites[0].file = 'test\\outside.test.ts',
    value => value.suites[0].file = 'test/*.test.ts',
    value => value.suites[0].file = '--passWithNoTests',
    value => value.suites.push(value.suites[0]),
    value => value.suites.push({ ...value.suites[0], file: value.suites[0].file.toUpperCase() }),
    value => value.suites[0].command = 'pnpm test',
  ])('rejects a narrowed or unrestricted candidate plan %#', (mutate) => {
    const value = structuredClone(baselineManifest)
    mutate(value)
    expect(() => validateManifest(value)).toThrow()
  })

  it.each([null, {}, [], { schemaVersion: 1 }])('rejects missing or malformed coverage %j', (value) => {
    expect(() => validateManifest(value)).toThrow()
  })

  it('requires the same expanded suites and exports in the report gate', () => {
    const coverage = extendedManifest()
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    expect(verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage).passed).toBe(114)
    report.testResults.pop()
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow()
    const binding = Object.fromEntries(baselineManifest.requiredExports.map(name => [name, () => {}]))
    expect(() => verifyNativeExports(binding, coverage)).toThrow('analyzeNpmChunksNative')
  })

  it('does not treat the minimum assertion count as permission to skip additional tests', () => {
    const coverage = extendedManifest()
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    report.testResults[0].assertionResults.push({ status: 'skipped', failureMessages: [] })
    report.numTotalTests++
    report.numPassedTests++
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow('skipped')
  })

  it('reads the exact candidate bytes and rejects missing suites or a mismatched workspace target', async () => {
    const fixture = await candidateFixture()
    roots.push(fixture.root)
    const loaded = await loadManifest(fixture.root)
    expect(loaded.manifest).toEqual(fixture.manifest)
    expect(loaded.bytes).toEqual(await readFile(path.join(fixture.root, manifestPath)))
    const suite = path.join(fixture.root, 'packages/ast-native', fixture.manifest.suites[0].file)
    await rm(suite)
    await expect(loadManifest(fixture.root)).rejects.toThrow()
    await writeFile(suite, '// restored fixture\n')
    await writeFile(path.join(fixture.root, 'packages/weapp-vite/package.json'), '{"name":"unexpected"}')
    await expect(loadManifest(fixture.root)).rejects.toThrow('workspace package')
  })

  it('rejects a suite symlink escaping the candidate checkout', async () => {
    const coverage = extendedManifest()
    coverage.suites.push({ file: 'test/escape/compilerAnalysis.test.ts', minimumAssertions: 1 })
    const fixture = await candidateFixture(coverage)
    const neighbor = await candidateFixture()
    roots.push(fixture.root, neighbor.root)
    const suiteDirectory = path.join(fixture.root, 'packages/ast-native/test/escape')
    await rm(suiteDirectory, { recursive: true })
    await symlink(path.join(neighbor.root, 'packages/ast-native/test'), suiteDirectory, process.platform === 'win32' ? 'junction' : 'dir')
    await expect(loadManifest(fixture.root)).rejects.toThrow('escapes candidate')
  })
})
