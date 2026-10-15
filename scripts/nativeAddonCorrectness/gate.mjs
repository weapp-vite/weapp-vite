import path from 'node:path'
import { baselineManifest, validateManifest } from './manifest.mjs'

export function verifyNativeExports(binding, coverage = baselineManifest) {
  const { requiredExports } = validateManifest(coverage)
  for (const name of requiredExports) {
    if (typeof binding?.[name] !== 'function') {
      throw new TypeError(`Required native export is missing: ${name}`)
    }
  }
  return [...requiredExports]
}

export function verifyNativeReport(report, packageRoot, coverage = baselineManifest) {
  const requiredSuites = new Map(validateManifest(coverage).suites.map(suite => [suite.file, suite.minimumAssertions]))
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
