import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { corpusJson, readCorpusArchive } from './archive'
import { defaultCorpusDirectory, defaultCorpusReports } from './paths'
import { inventoryCorpus } from './report'
import { auditFrameworkMatrix } from './report/framework'
import { runBrowserAcceptance } from './test/browser'
import { runNodeAcceptance } from './test/node'

const { values } = parseArgs({ options: {
  suite: { type: 'string', default: 'all' },
  corpus: { type: 'string', default: defaultCorpusDirectory },
  output: { type: 'string', default: defaultCorpusReports },
} })
if (!['all', 'corpus', 'fuzz'].includes(values.suite)) {
  throw new TypeError('Expected --suite all, corpus or fuzz')
}
const suite = values.suite as 'all' | 'corpus' | 'fuzz'
const { manifest, documents } = await readCorpusArchive(values.corpus)
const inventory = inventoryCorpus(documents, manifest)
const matrix = await auditFrameworkMatrix(manifest.generations)
inventory.gaps.push(...matrix.gaps)
inventory.accepted &&= matrix.accepted
const options = { corpusDirectory: values.corpus, outputDirectory: path.join(values.output, suite), suite }
const { node, chromium } = await withMachineE2ELease(async () => {
  const node = await runNodeAcceptance(options)
  const chromium = await runBrowserAcceptance(options)
  return { node, chromium }
})
const accepted = inventory.accepted && node.accepted && chromium.accepted
await mkdir(values.output, { recursive: true })
await writeFile(path.join(values.output, `verdict-${suite}.json`), `${corpusJson({ accepted, contentSha256: manifest.contentSha256, inventory, node: node.accepted, chromium: chromium.accepted })}\n`)
process.stdout.write(`Template ${suite}: ${accepted ? 'passed' : 'failed'}; Node=${node.accepted}, Chromium=${chromium.accepted}, inventory=${inventory.accepted}\n`)
process.exitCode = accepted ? 0 : 1
