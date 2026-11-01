import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { installTarballRunner } from './createWeappViteSmoke/commands.mjs'
import { reportError } from './createWeappViteSmoke/registry.mjs'
import { cleanupSmokeDirectory } from './createWeappViteSmoke/reporting.mjs'
import { resolveSmokeSource } from './createWeappViteSmoke/source.mjs'
import { readPackedPackageJsonFromTarball } from './print-rolldown-versions.mjs'
import { readCandidates } from './verifyVitePlusTemplates/artifacts.mjs'
import { selectCases, strictEnvironment } from './verifyVitePlusTemplates/contracts.mjs'
import { runCase, runStep } from './verifyVitePlusTemplates/runner.mjs'

/** 只消费已经构建打包的候选，不构建源码、不调用 registry 中的脚手架版本。 */
export async function verifyVitePlusTemplates(env = process.env) {
  assert(env.CREATE_WEAPP_VITE_TARBALL, 'CREATE_WEAPP_VITE_TARBALL is required')
  const tarball = path.resolve(env.CREATE_WEAPP_VITE_TARBALL)
  const manifest = readPackedPackageJsonFromTarball(tarball)
  assert.equal(manifest.name, 'create-weapp-vite', 'Expected a create-weapp-vite tarball')
  const source = await resolveSmokeSource({ source: 'workspace', sourceCommit: env.CREATE_WEAPP_VITE_SOURCE_COMMIT, tarball, expectedTarballSha256: env.CREATE_WEAPP_VITE_TARBALL_SHA256 })
  const artifacts = await readCandidates(env.CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS)
  const { matrix, selected } = selectCases(env.VITE_PLUS_TEMPLATE_CASES)
  const timeoutMs = Number(env.VITE_PLUS_TEMPLATE_TIMEOUT_MS ?? 600_000)
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'VITE_PLUS_TEMPLATE_TIMEOUT_MS must be a positive integer')
  const registry = env.VITE_PLUS_TEMPLATE_REGISTRY || 'https://registry.npmjs.org/'
  const url = new URL(registry)
  assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Registry must be an HTTP(S) URL without embedded credentials')
  const reportBase = path.resolve(env.VITE_PLUS_TEMPLATE_REPORT_DIR || '.tmp/current-run/templates-vite-plus/consumers')
  await fs.mkdir(reportBase, { recursive: true })
  const reportRoot = await fs.mkdtemp(path.join(reportBase, 'run-'))
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vite-plus-template-consumer-'))
  const privateRoots = [temporaryRoot, os.homedir(), tarball, ...artifacts.map(item => item.tarball)]
  const report = {
    schemaVersion: 1,
    ...source,
    scaffold: { filename: path.basename(tarball), version: manifest.version },
    candidates: artifacts.map(({ name, filename, version, sha256, integrity }) => ({ name, filename, version, sha256, integrity })),
    node: process.version,
    platform: process.platform,
    registry,
    matrix: matrix.map(item => item.id),
    selected: selected.map(item => item.id),
    fullMatrix: selected.length === matrix.length,
    status: 'in-progress',
    complete: false,
    setup: [],
    results: [],
  }
  const reportFile = path.join(reportRoot, 'report.json')
  const flush = () => fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  await flush()
  console.log(`Vite+ template report: ${reportFile}`)
  try {
    const runnerEnv = strictEnvironment(registry, path.join(temporaryRoot, 'cache'), env)
    let packageRoot
    await runStep({ id: 'setup', steps: report.setup, reportRoot, privateRoots, timeoutMs, flush }, 'install-scaffold', {}, undefined, async () => {
      packageRoot = await installTarballRunner(tarball, path.join(temporaryRoot, 'runner'), runnerEnv, timeoutMs)
      const installed = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'))
      assert.equal(installed.version, manifest.version, 'Installed scaffold version does not match tarball')
      return { stdout: `Installed create-weapp-vite ${installed.version}`, stderr: '' }
    })
    for (const testCase of selected) {
      await runCase(testCase, { temporaryRoot, packageRoot, registry, artifacts, reportRoot, timeoutMs, flush, report, privateRoots, env })
    }
    report.complete = true
    report.status = report.results.every(item => item.status === 'passed') ? 'passed' : 'failed'
  }
  catch (error) {
    report.status = 'failed'
    report.error = reportError(error, privateRoots)
  }
  finally {
    report.notRun = selected.filter(item => !report.results.some(result => result.id === item.id)).map(item => item.id)
    try {
      if (env.VITE_PLUS_TEMPLATE_KEEP_WORKSPACE === '1') {
        report.cleanup = 'retained-by-request'
        console.log(`Retained Vite+ template workspace: ${temporaryRoot}`)
      }
      else {
        await cleanupSmokeDirectory(temporaryRoot)
        report.cleanup = 'passed'
      }
    }
    catch (error) {
      report.cleanup = 'failed'
      report.status = 'failed'
      report.cleanupError = reportError(error, privateRoots)
    }
    await flush()
  }
  return { report, reportFile }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { report } = await verifyVitePlusTemplates()
  console.log(JSON.stringify({ status: report.status, complete: report.complete, fullMatrix: report.fullMatrix, results: report.results.map(({ id, status }) => ({ id, status })) }, null, 2))
  process.exitCode = report.status === 'passed' && report.complete ? 0 : 1
}
