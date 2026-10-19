import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { completeTelemetryContract } from './contract.mjs'

export async function finalizeContractCli(args = process.argv.slice(2)) {
  const option = (name) => {
    const value = args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
    assert(value, `Missing --${name}=<file>`)
    return value
  }
  const preparation = JSON.parse(await fs.readFile(option('preparation'), 'utf8'))
  const expectedIds = JSON.parse(await fs.readFile(option('expected-ids'), 'utf8'))
  const contract = completeTelemetryContract(preparation, expectedIds)
  const output = option('output')
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(contract, null, 2)}\n`)
  return contract
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await finalizeContractCli()
}
