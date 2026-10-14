import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const requiredExports = [
  'analyzeCompilerScriptsNative',
  'analyzeNpmChunksNative',
  'analyzeScriptNative',
  'analyzeScriptsNative',
  'collectFeatureFlagsNative',
  'collectOnPageScrollDiagnosticsNative',
  'getVueSfcSignaturePayloadNative',
  'mayContainPlatformApiAccessNative',
  'mayContainStaticRequireLiteralNative',
]
// 固定基础语料覆盖下限，防止文件筛选、only 或空 suite 被误算成完整通过。
const requiredSuites = new Map([
  ['test/compilerAnalysis.test.ts', 33],
  ['test/compilerAmbientParity.test.ts', 7],
  ['test/npmChunksParity.test.ts', 13],
  ['test/npmChunkRewriteParity.test.ts', 6],
  ['test/onPageScroll.test.ts', 11],
  ['test/vueSfcSignature.fuzz.test.ts', 44],
])

export function verifyNativeExports(binding) {
  for (const name of requiredExports) {
    if (typeof binding?.[name] !== 'function') {
      throw new TypeError(`Required native export is missing: ${name}`)
    }
  }
  return [...requiredExports]
}

export function verifyNativeReport(report, packageRoot) {
  if (report?.success !== true || !Array.isArray(report.testResults)) {
    throw new Error('Missing successful Vitest correctness report')
  }
  for (const key of ['numTotalTestSuites', 'numPassedTestSuites', 'numTotalTests', 'numPassedTests']) {
    if (!Number.isSafeInteger(report[key]) || report[key] <= 0) {
      throw new Error(`Missing positive test counter: ${key}`)
    }
  }
  for (const key of ['numFailedTestSuites', 'numPendingTestSuites', 'numFailedTests', 'numPendingTests', 'numTodoTests']) {
    if (report[key] !== 0) {
      throw new Error(`Correctness report has failed or unexecuted tests: ${key}`)
    }
  }
  if (report.numPassedTests !== report.numTotalTests || report.numPassedTestSuites !== report.numTotalTestSuites
    || report.numTotalTestSuites < report.testResults.length) {
    throw new Error('Correctness report counters are incomplete')
  }

  const suites = new Map()
  for (const result of report.testResults) {
    if (typeof result?.name !== 'string') {
      throw new TypeError('Correctness report has a missing suite name')
    }
    const name = path.relative(packageRoot, result.name).replaceAll('\\', '/')
    if (!requiredSuites.has(name) || suites.has(name)) {
      throw new Error('Correctness report has an unexpected or duplicate suite')
    }
    if (result.status !== 'passed' || !Array.isArray(result.assertionResults)
      || result.assertionResults.length < requiredSuites.get(name)) {
      throw new Error(`Correctness suite is failed, empty, or partial: ${name}`)
    }
    for (const assertion of result.assertionResults) {
      if (assertion?.status !== 'passed' || !Array.isArray(assertion.failureMessages)
        || assertion.failureMessages.length !== 0) {
        throw new Error(`Correctness suite has a failed, skipped, or todo assertion: ${name}`)
      }
    }
    suites.set(name, { file: `packages/ast-native/${name}`, passed: result.assertionResults.length })
  }
  if (suites.size !== requiredSuites.size
    || [...suites.values()].reduce((count, suite) => count + suite.passed, 0) !== report.numTotalTests) {
    throw new Error('Correctness report omits suites or assertions')
  }
  return { status: 'passed', passed: report.numPassedTests, skipped: 0, suites: [...suites.values()] }
}

async function main() {
  const [mode, directory] = process.argv.slice(2)
  if (!['binding', 'report'].includes(mode) || !directory) {
    throw new Error('Usage: node scripts/verify-native-addon-correctness.mjs <binding|report> <evidence-directory>')
  }
  const outputDirectory = path.resolve(directory)
  await mkdir(outputDirectory, { recursive: true })
  if (mode === 'binding') {
    await Promise.all(['binding.json', 'raw-vitest.json', 'summary.json'].map(name =>
      rm(path.join(outputDirectory, name), { force: true }),
    ))
    const binding = await import('../packages/ast-native/index.js')
    const coveredExports = verifyNativeExports(binding)
    await writeFile(path.join(outputDirectory, 'binding.json'), `${JSON.stringify({
      status: 'passed',
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      exports: coveredExports,
    }, null, 2)}\n`)
    return
  }

  let summary
  try {
    const binding = JSON.parse(await readFile(path.join(outputDirectory, 'binding.json'), 'utf8'))
    if (binding.status !== 'passed' || binding.platform !== process.platform
      || binding.arch !== process.arch || binding.node !== process.versions.node
      || !Array.isArray(binding.exports) || binding.exports.length !== requiredExports.length
      || requiredExports.some((name, index) => binding.exports[index] !== name)) {
      throw new Error('Required actual-addon export preflight did not pass')
    }
    const report = JSON.parse(await readFile(path.join(outputDirectory, 'raw-vitest.json'), 'utf8'))
    summary = verifyNativeReport(report, path.join(repositoryRoot, 'packages/ast-native'))
  }
  catch {
    summary = { status: 'failed', reason: 'Actual-addon preflight or complete correctness report is missing or invalid' }
    process.exitCode = 1
  }
  await writeFile(path.join(outputDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  if (summary.status !== 'passed') {
    throw new Error(summary.reason)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
