import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const [output, input] = process.argv.slice(2)
const upstreamRoot = process.env.DIMINA_PREPARED_ROOT
if (!output || !input || !upstreamRoot) {
  throw new Error('DMCC requires output and input directories')
}
const { default: compile } = await import(pathToFileURL(path.join(upstreamRoot, 'fe/packages/compiler/dist/index.js')).href)
await compile(output, input, true, { sourcemap: true })
