import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { finalizeContractCli } from './contractCli.mjs'
import { finalizeBaselineCoverage } from './coverage.mjs'

export async function runTelemetryCli(args = process.argv.slice(2), root = process.cwd()) {
  if (args[0] === 'finalize-contract') {
    return await finalizeContractCli(args.slice(1))
  }
  if (args[0] === 'finalize-coverage') {
    const output = path.join(root, '.tmp/verification-telemetry/coverage')
    try {
      await fs.access(path.join(output, 'plan.json'))
    }
    catch (error) {
      if (args.includes('--if-present') && error.code === 'ENOENT') {
        return
      }
      throw error
    }
    return await finalizeBaselineCoverage(root, output, { commandSucceeded: args.includes('--command-succeeded') })
  }
  if (args[0] === 'prepare-suites') {
    const { prepareBaselineSuites } = await import('./suite.ts')
    return await prepareBaselineSuites(root, args.find(arg => arg.startsWith('--mode='))?.slice(7))
  }
  throw new Error('Expected finalize-coverage or prepare-suites')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(path.resolve(process.argv[1])))) {
  await runTelemetryCli()
}
