import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { verifyNativeExports, verifyNativeReport } from './verify-native-addon-correctness.mjs'

const packageRoot = path.resolve('fixture-native-package')

async function addonJob() {
  const source = await readFile(new URL('../.github/workflows/native-addon-correctness.yml', import.meta.url), 'utf8')
  return parse(source).jobs['actual-addon']
}

function successfulReport() {
  const counts = [
    ['compilerAnalysis.test.ts', 33],
    ['compilerAmbientParity.test.ts', 7],
    ['onPageScroll.test.ts', 11],
    ['vueSfcSignature.fuzz.test.ts', 44],
  ]
  return {
    success: true,
    numTotalTestSuites: 8,
    numPassedTestSuites: 8,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: 95,
    numPassedTests: 95,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: counts.map(([name, count]) => ({
      name: path.join(packageRoot, 'test', name),
      status: 'passed',
      assertionResults: Array.from({ length: count }, () => ({ status: 'passed', failureMessages: [] })),
    })),
  }
}

describe('actual-addon correctness evidence gate', () => {
  it('accepts complete results and emits only portable file names and counts', () => {
    const summary = verifyNativeReport(successfulReport(), packageRoot)
    expect(summary.passed).toBe(95)
    expect(summary.skipped).toBe(0)
    expect(summary.suites.map(suite => suite.file)).toEqual([
      'packages/ast-native/test/compilerAnalysis.test.ts',
      'packages/ast-native/test/compilerAmbientParity.test.ts',
      'packages/ast-native/test/onPageScroll.test.ts',
      'packages/ast-native/test/vueSfcSignature.fuzz.test.ts',
    ])
    expect(JSON.stringify(summary)).not.toContain(packageRoot)
  })

  it.each(['skipped', 'todo', 'pending', 'failed', undefined])('rejects an assertion whose status is %s', (status) => {
    const report = successfulReport()
    report.testResults[0].assertionResults[0].status = status
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
  })

  it.each(['numFailedTestSuites', 'numPendingTestSuites', 'numFailedTests', 'numPendingTests', 'numTodoTests'])('rejects unexecuted aggregate counter %s', (key) => {
    const report = successfulReport()
    report[key] = 1
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
    delete report[key]
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
  })

  it.each(['numTotalTestSuites', 'numPassedTestSuites', 'numTotalTests', 'numPassedTests'])('rejects missing or inconsistent positive counter %s', (key) => {
    const report = successfulReport()
    report[key] = 0
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
    report[key] = 1.5
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
    delete report[key]
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
  })

  it.each([
    report => report.testResults.pop(),
    report => report.testResults.push(report.testResults[0]),
    report => report.testResults[0].assertionResults.pop(),
    report => report.testResults[0].assertionResults.splice(0),
    report => report.testResults[0].name = 'unexpected.test.ts',
    report => delete report.testResults[0].name,
    report => report.testResults[0].status = 'failed',
    report => report.testResults[0].assertionResults[0].failureMessages.push('hidden failure'),
    report => report.numTotalTests++,
    report => report.numPassedTestSuites--,
    report => report.numTotalTestSuites = report.numPassedTestSuites = 1,
    report => report.success = false,
  ])('rejects partial or inconsistent results %#', (mutate) => {
    const report = successfulReport()
    mutate(report)
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
  })

  it.each([undefined, null, {}, { success: true, testResults: [] }])('rejects missing, empty, or incomplete report %j', (report) => {
    expect(() => verifyNativeReport(report, packageRoot)).toThrow()
  })

  it('rejects a missing addon object or required export without skipping', () => {
    expect(() => verifyNativeExports(undefined)).toThrow('Required native export is missing')
    const names = [
      'analyzeCompilerScriptsNative',
      'analyzeScriptNative',
      'analyzeScriptsNative',
      'collectFeatureFlagsNative',
      'collectOnPageScrollDiagnosticsNative',
      'getVueSfcSignaturePayloadNative',
      'mayContainPlatformApiAccessNative',
      'mayContainStaticRequireLiteralNative',
    ]
    const binding = Object.fromEntries(names.map(name => [name, () => {}]))
    expect(verifyNativeExports(binding)).toEqual(names)
    for (const name of names) {
      expect(() => verifyNativeExports({ ...binding, [name]: undefined })).toThrow(name)
    }
  })

  it('rejects the former 88-test report that omits ambient compiler parity', () => {
    const report = successfulReport()
    report.testResults.splice(1, 1)
    report.numTotalTestSuites = report.numPassedTestSuites = 6
    report.numTotalTests = report.numPassedTests = 88
    expect(() => verifyNativeReport(report, packageRoot)).toThrow('omits suites or assertions')
  })

  it.each([0, 6])('rejects ambient compiler parity with only %s results', (count) => {
    const report = successfulReport()
    report.testResults[1].assertionResults.splice(count)
    report.numTotalTests = report.numPassedTests = 88 + count
    expect(() => verifyNativeReport(report, packageRoot)).toThrow('failed, empty, or partial')
  })
})

describe('actual-addon CI execution contract', () => {
  it('builds on all three hosts with a fixed Node version and the package-owned Rust toolchain', async () => {
    const job = await addonJob()
    expect([...job.strategy.matrix.os].sort()).toEqual(['macos-latest', 'ubuntu-latest', 'windows-latest'])
    // eslint-disable-next-line no-template-curly-in-string -- 验证 GitHub Actions 的表达式原文。
    expect(job['runs-on']).toBe('${{ matrix.os }}')
    const node = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'))
    expect(node.with['node-version']).toBe('24.18.0')
    const rust = job.steps.find(step => step.run?.startsWith('rustup '))
    expect(rust['working-directory']).toBe('packages/ast-native')
    expect(rust.run).toBe('rustup show active-toolchain')
    const install = job.steps.find(step => step.run?.startsWith('pnpm install '))
    expect(install.run).toContain('--frozen-lockfile')
    expect(install.run).toContain('--ignore-scripts')
    const build = job.steps.find(step => step.run?.includes(' exec napi build '))
    expect(build.run).toContain('--filter @weapp-vite/ast-native')
    expect(build.run).toContain('--release')
    expect(build.run).toContain('--platform')
    expect(build.run).toContain('--no-js')
    expect(build.run).toContain('-- --locked')
    expect(build.run).not.toMatch(/noop|--all-features|--features/)
  })

  it('requires the addon before the native tests and validates complete evidence even after test failure', async () => {
    const { steps } = await addonJob()
    const preflightIndex = steps.findIndex(step => step.run?.includes('verify-native-addon-correctness.mjs binding '))
    const testsIndex = steps.findIndex(step => step.run?.includes('--config native.vitest.config.ts'))
    const gateIndex = steps.findIndex(step => step.run?.includes('verify-native-addon-correctness.mjs report '))
    expect(preflightIndex).toBeGreaterThanOrEqual(0)
    expect(testsIndex).toBeGreaterThan(preflightIndex)
    expect(gateIndex).toBeGreaterThan(testsIndex)
    const tests = steps[testsIndex]
    expect(tests['working-directory']).toBe('packages/ast-native')
    for (const file of ['compilerAnalysis.test.ts', 'compilerAmbientParity.test.ts', 'onPageScroll.test.ts', 'vueSfcSignature.fuzz.test.ts']) {
      expect(tests.run).toContain(`test/${file}`)
    }
    expect(tests.run).toContain('--reporter=json')
    expect(tests.run).toContain('--outputFile=../../.tmp/native-addon-correctness/raw-vitest.json')
    expect(tests.run).not.toContain('--passWithNoTests')
    expect(steps[gateIndex].if).toBe('always()')
    const selfTest = steps.find(step => step.run?.includes('scripts/verify-native-addon-correctness.test.mjs'))
    expect(selfTest.run).toContain('--config scripts/vitest.config.mjs')
    const compilerBuildIndex = steps.findIndex(step => step.run?.includes('--filter=@wevu/compiler...'))
    expect(compilerBuildIndex).toBeGreaterThan(preflightIndex)
    expect(compilerBuildIndex).toBeLessThan(testsIndex)
    expect(steps[compilerBuildIndex].run).toContain('--concurrency=1')
  })

  it('uploads hidden evidence through a strict two-JSON allowlist that excludes raw runner paths', async () => {
    const { steps } = await addonJob()
    const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'))
    expect(uploads).toHaveLength(1)
    expect(uploads[0].if).toBe('always()')
    expect(uploads[0].with['include-hidden-files']).toBe(true)
    expect(uploads[0].with['if-no-files-found']).toBe('error')
    expect(uploads[0].with.path.trim().split('\n')).toEqual([
      '.tmp/native-addon-correctness/binding.json',
      '.tmp/native-addon-correctness/summary.json',
    ])
  })
})
