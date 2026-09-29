import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { upstreamRoot } from '../config'

const [output, input] = process.argv.slice(2)
if (!output || !input) {
  throw new Error('DMCC requires output and input directories')
}
const { default: compile } = await import(pathToFileURL(path.join(upstreamRoot, 'fe/packages/compiler/dist/index.js')).href)
await compile(output, input, true, { sourcemap: true })
