import type { Checkout } from './collect'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { collectAutoImport } from './autoImport'
import { collectBuilds, collectHmr } from './collect'
import { PartialHmrCollectionError } from './hmrSamples'

const directory = path.resolve(process.env.PERFORMANCE_SAMPLE_DIR!)
const input = JSON.parse(await readFile(path.join(directory, 'input.json'), 'utf8')) as {
  checkout: Checkout
  shard: string
  configurations?: string[]
}
let values: Awaited<ReturnType<typeof collectBuilds>> = []
const errors: string[] = []
try {
  if (input.shard === 'build') {
    values = await collectBuilds(input.checkout, directory)
  }
  else if (input.shard.startsWith('hmr:')) {
    values = await collectHmr(input.checkout, process.cwd(), directory, input.shard.split(':')[1]!)
  }
  else if (input.shard === 'auto-build' || input.shard === 'auto-hmr') {
    values = await collectAutoImport(input.checkout, process.cwd(), directory, input.shard === 'auto-build' ? 'build' : 'hmr', input.configurations)
  }
  else {
    throw new Error('Invalid collector kind')
  }
}
catch (error) {
  if (error instanceof PartialHmrCollectionError) {
    values = error.samples
  }
  errors.push(String(error).replaceAll(input.checkout.cwd, '<checkout>').replaceAll(process.cwd(), '<driver>'))
}
await writeFile(path.join(directory, 'values.json'), JSON.stringify({ values, errors }))
if (errors.length) {
  process.exitCode = 1
}
