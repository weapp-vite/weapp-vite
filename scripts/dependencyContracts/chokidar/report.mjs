import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { nonApplicableReason, scenarios } from './scenarios.mjs'

export const hashText = value => createHash('sha256').update(value).digest('hex')

export function parseContractArguments(args) {
  assert.equal(args.length, 2, 'Usage: run.mjs --report <file>')
  assert.equal(args[0], '--report', 'Only --report is supported; every applicable contract is mandatory')
  assert.ok(args[1]?.trim() && !args[1].startsWith('--'), 'A report file is required')
  return { reportFile: path.resolve(args[1]) }
}

export async function installedChokidar() {
  const require = createRequire(import.meta.url)
  const entry = require.resolve('chokidar')
  const directory = path.dirname(entry)
  const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  assert.equal(metadata.name, 'chokidar', 'Resolve the installed formal dependency only')
  const hashes = {}
  for (const name of ['index.js', 'handler.js', 'package.json']) {
    hashes[name] = hashText(await readFile(path.join(directory, name)))
  }
  return { entry, directory, version: metadata.version, hashes }
}

export function createContractCleanupKey(reportFile, fixtureRoot, pid) {
  assert.ok(path.isAbsolute(reportFile) && path.isAbsolute(fixtureRoot))
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  return `chokidar-contract:${JSON.stringify({ reportFile, fixtureRoot, pid })}`
}

export function normalizeReport(value, roots) {
  if (typeof value === 'string') {
    let normalized = value
    let replaced = false
    const replacements = [...roots, [tmpdir(), '<temp>'], [homedir(), '<home>']]
      .filter(([root]) => root)
      .sort(([left], [right]) => right.length - left.length)
    for (const [root, label] of replacements) {
      for (const variant of new Set([root, root.replaceAll('\\', '/'), JSON.stringify(root).slice(1, -1)])) {
        if (normalized.includes(variant)) {
          normalized = normalized.replaceAll(variant, label)
          replaced = true
        }
      }
    }
    return replaced ? normalized.replaceAll('\\', '/') : normalized
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeReport(item, roots))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeReport(item, roots)]))
  }
  return value
}

export function completeContractReport(report) {
  assert.equal(report.status, 'running', 'Only a running report can complete')
  assert.deepEqual(report.results.map(item => item.id), scenarios.map(item => item.id), 'All contracts must complete in order')
  for (const [index, result] of report.results.entries()) {
    const reason = nonApplicableReason(scenarios[index], report.nativePlatform)
    if (reason) {
      assert.equal(result.status, 'non-applicable')
      assert.equal(result.reason, reason)
      assert.equal(result.workerStarted, false, 'An unsupported native branch must not fake a passing worker')
    }
    else {
      assert.equal(result.status, 'passed', `${result.id} did not pass`)
      assert.equal(result.report?.status, 'passed', 'A passing result requires real worker observations')
      assert.equal(result.cleanupConfirmed, true, 'All real resources must be terminal')
    }
    assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0)
  }
  assert.equal(report.ownership?.scope, 'completed')
  assert.equal(report.error, undefined)
  return {
    status: 'passed',
    planned: scenarios.length,
    passed: report.results.filter(item => item.status === 'passed').length,
    nonApplicable: report.results.filter(item => item.status === 'non-applicable').length,
    failed: 0,
  }
}
