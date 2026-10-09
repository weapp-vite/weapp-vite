import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine.ts'
import { completeContractReport, contractNames, createContractCleanupKey, hashText, normalizeReport, parseContractArguments, UnconfirmedContractCleanupError } from './helpers.mjs'
import { escaped, hooks } from './hooks.mjs'
import { closing, failFast, failures } from './lifecycle.mjs'
import { retention } from './retention.mjs'
import { scanning, watching } from './watch.mjs'

const { reportFile } = parseContractArguments(process.argv.slice(2))
assert.equal(typeof globalThis.gc, 'function', 'Run in an independent Node process with --expose-gc --import tsx')
await mkdir(path.dirname(reportFile), { recursive: true })
let fixtureRoot
const report = {
  schemaVersion: 1,
  node: process.version,
  status: 'running',
  startedAt: new Date().toISOString(),
  results: [],
}
const serialize = () => `${JSON.stringify(fixtureRoot ? normalizeReport(report, fixtureRoot) : report, null, 2)}\n`
const persist = () => writeFile(reportFile, serialize())

try {
  await withMachineE2ELease(async (lease) => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), 'rolldown-contracts-'))
    const cleanupKey = createContractCleanupKey(reportFile, fixtureRoot, process.pid)
    const childScope = await lease.createChildScope({ cleanupKey })
    report.ownership = { domain: 'rolldown-contract', bindingSha256: hashText(cleanupKey), pid: process.pid, scope: 'active' }
    let timeout
    let termination
    const preserveAndExit = async (status, error, exitCode) => {
      clearTimeout(timeout)
      report.status = status
      report.error = { message: String(error), stack: error?.stack, errors: error?.errors?.map(item => ({ message: String(item), stack: item?.stack })) }
      report.cleanup = { status: 'unconfirmed', lease: 'preserved', fixture: 'preserved', bindingSha256: hashText(cleanupKey) }
      try {
        await childScope.seal()
        report.cleanup.scope = 'sealed'
        report.ownership.scope = 'sealed'
      }
      catch (sealError) {
        report.cleanup.scope = 'seal-failed'
        report.cleanup.error = { message: String(sealError), stack: sealError?.stack }
      }
      report.finishedAt = new Date().toISOString()
      try {
        writeFileSync(reportFile, serialize())
      }
      catch (reportError) {
        console.error('Could not persist the final contract report:', reportError)
      }
      console.error('Native contract cleanup is unconfirmed; this process exits with its incomplete non-IDE scope preserved')
      // 未完成的独立 scope 阻止死 owner 自动回收，也不能被父入口当作空 IDE journal 完成。
      process.exit(exitCode)
    }
    const terminate = (status, error, exitCode) => {
      termination ??= preserveAndExit(status, error, exitCode)
      return termination
    }
    timeout = setTimeout(() => {
      void terminate('timeout', new Error('Contract supervisor timeout'), 2)
    }, 120_000)
    let failure
    const cleanupErrors = []
    try {
      const require = createRequire(import.meta.url)
      const packageFile = require.resolve('rolldown/package.json')
      const metadata = JSON.parse(await readFile(packageFile, 'utf8'))
      assert.equal(metadata.name, 'rolldown')
      report.rolldown = metadata.version
      report.entrySha256 = hashText(await readFile(require.resolve('rolldown'), 'utf8'))
      const sharedDirectory = path.join(path.dirname(packageFile), 'dist', 'shared')
      const bindingChunks = (await readdir(sharedDirectory)).filter(name => name.startsWith('bindingify-input-options-') && name.endsWith('.mjs'))
      assert.equal(bindingChunks.length, 1, 'Expected one installed options binding chunk')
      report.optionsBinding = {
        file: `dist/shared/${bindingChunks[0]}`,
        sha256: hashText(await readFile(path.join(sharedDirectory, bindingChunks[0]), 'utf8')),
      }
      const { rolldown, watch } = await import('rolldown')
      const { scan } = await import('rolldown/experimental')
      const cases = {
        hooks: () => hooks(rolldown, fixtureRoot),
        escaped: () => escaped(rolldown, fixtureRoot),
        closing: () => closing(rolldown, fixtureRoot),
        failures: () => failures(rolldown, fixtureRoot),
        failFast: () => failFast(rolldown, fixtureRoot),
        retention: () => retention(rolldown, fixtureRoot),
        watching: () => watching(watch, fixtureRoot),
        scanning: () => scanning(scan, fixtureRoot),
      }
      for (const name of contractNames) {
        if (termination) {
          await termination
        }
        report.currentContract = name
        await persist()
        const started = performance.now()
        console.log(`contract:start:${name}`)
        try {
          const result = await cases[name]()
          if (termination) {
            await termination
          }
          report.results.push({ name, status: 'passed', result, durationMs: performance.now() - started })
        }
        catch (error) {
          report.results.push({ name, status: 'failed', error: { message: String(error), stack: error?.stack, actual: error?.actual, expected: error?.expected }, durationMs: performance.now() - started })
          throw error
        }
        await persist()
        console.log(`contract:passed:${name}`)
      }
      delete report.currentContract
    }
    catch (error) {
      failure = { error }
      if (error instanceof UnconfirmedContractCleanupError) {
        await terminate('failed', error, 1)
      }
    }
    finally {
      if (termination) {
        await termination
      }
      try {
        await rm(fixtureRoot, { recursive: true, force: true })
      }
      catch (error) {
        cleanupErrors.push(error)
      }
      try {
        await childScope.seal()
        report.ownership.scope = 'sealed'
      }
      catch (error) {
        cleanupErrors.push(error)
      }
      if (cleanupErrors.length === 0) {
        try {
          await childScope.complete()
          report.ownership.scope = 'completed'
        }
        catch (error) {
          cleanupErrors.push(error)
        }
      }
      clearTimeout(timeout)
    }
    if (cleanupErrors.length) {
      throw new AggregateError(failure ? [failure.error, ...cleanupErrors] : cleanupErrors, 'Contract resource cleanup failed', { cause: failure?.error })
    }
    if (failure) {
      throw failure.error
    }
  })
  Object.assign(report, completeContractReport(report))
}
catch (error) {
  report.status = 'failed'
  report.error = { message: String(error), stack: error?.stack, errors: error?.errors?.map(item => ({ message: String(item), stack: item?.stack })) }
  process.exitCode = 1
}
finally {
  report.finishedAt = new Date().toISOString()
  await persist()
  console.log(JSON.stringify({ status: report.status, completed: report.results.filter(item => item.status === 'passed').map(item => item.name) }))
}
