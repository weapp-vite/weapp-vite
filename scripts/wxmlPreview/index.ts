import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { confirmPreview } from './confirm.ts'
import { preparePreview } from './prepare.ts'

const [mode, manifest, ...extra] = process.argv.slice(2)
assert.ok(extra.length === 0 && (mode === 'prepare' ? !manifest : mode === 'confirm' && manifest), 'Usage: node --import tsx scripts/wxmlPreview/index.ts prepare | confirm <manifest>')
if (mode === 'prepare') {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const result = await preparePreview({ root })
  process.stdout.write(`Prepared ${result.metadata.name}@${result.metadata.version} (${result.metadata.tag})\n`)
}
else {
  const result = await confirmPreview({ manifest: path.resolve(manifest!) })
  process.stdout.write(result.summary)
}
