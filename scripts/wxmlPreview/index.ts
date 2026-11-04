import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { confirmPreview } from './confirm.ts'
import { preparePreview } from './prepare.ts'
import { recoverPreview } from './recover.ts'

const [mode, manifest, ...extra] = process.argv.slice(2)
assert.ok(extra.length === 0 && (mode === 'prepare' || mode === 'recover' ? !manifest : mode === 'confirm' && manifest), 'Usage: node --import tsx scripts/wxmlPreview/index.ts prepare | recover | confirm <manifest>')
if (mode === 'prepare') {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const result = await preparePreview({ root })
  process.stdout.write(`Prepared ${result.metadata.name}@${result.metadata.version} (${result.metadata.tag})\n`)
}
else if (mode === 'recover') {
  const result = await recoverPreview()
  process.stdout.write(result.summary)
}
else {
  const result = await confirmPreview({ manifest: path.resolve(manifest!) })
  process.stdout.write(result.summary)
}
