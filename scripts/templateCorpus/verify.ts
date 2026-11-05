import type { ApiVariant } from './test/harness'
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
import { captureFrozenRun, runFrozenAcceptance } from './test/frozenRun'
import { apiVariants } from './test/harness'
import { runNodeAcceptance } from './test/node'

const { values } = parseArgs({ options: {
  'suite': { type: 'string', default: 'all' },
  'corpus': { type: 'string', default: defaultCorpusDirectory },
  'output': { type: 'string', default: defaultCorpusReports },
  'api-variant': { type: 'string', default: 'all' },
} })
if (!['all', 'corpus', 'fuzz'].includes(values.suite)) {
  throw new TypeError('Expected --suite all, corpus or fuzz')
}
const suite = values.suite as 'all' | 'corpus' | 'fuzz'
if (values['api-variant'] !== 'all' && !apiVariants.includes(values['api-variant'] as ApiVariant)) {
  throw new TypeError('Expected --api-variant all, root or core')
}
const selectedVariants = values['api-variant'] === 'all' ? apiVariants : [values['api-variant'] as ApiVariant]
const options = selectedVariants.map(apiVariant => ({ corpusDirectory: values.corpus, outputDirectory: path.join(values.output, suite, apiVariant), suite, apiVariant }))
const identity = await captureFrozenRun(options)
const { manifest, documents } = await readCorpusArchive(values.corpus)
const inventory = inventoryCorpus(documents, manifest)
const matrix = await auditFrameworkMatrix(manifest.generations)
inventory.gaps.push(...matrix.gaps)
inventory.accepted &&= matrix.accepted
const frozenRun = await withMachineE2ELease(() => runFrozenAcceptance(options, identity, { node: runNodeAcceptance, chromium: runBrowserAcceptance }))
const { variants } = frozenRun
const accepted = inventory.accepted && frozenRun.identityUnchanged && frozenRun.errors.length === 0 && selectedVariants.every(variant => variants[variant]?.node && variants[variant]?.chromium)
await mkdir(values.output, { recursive: true })
await writeFile(path.join(values.output, `verdict-${suite}-${values['api-variant']}.json`), `${corpusJson({ ...frozenRun, accepted, completeVariants: selectedVariants.length === apiVariants.length, contentSha256: manifest.contentSha256, inventory })}\n`)
process.stdout.write(`Template ${suite}: ${accepted ? 'passed' : 'failed'}; ${corpusJson(variants)}, inventory=${inventory.accepted}\n`)
process.exitCode = accepted ? 0 : 1
