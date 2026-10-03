import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { compareSequenceProfilePairs } from './profileComparison'

const [budget, ...paths] = process.argv.slice(2)
if (!budget || paths.length < 4 || paths.length % 2) {
  throw new Error('Usage: node --import tsx scripts/editSequence/compareProfiles.ts max-overhead-percent off-first.json on-first.json off-second.json on-second.json')
}
const pairs: Parameters<typeof compareSequenceProfilePairs>[0] = []
for (let index = 0; index < paths.length; index += 2) {
  const off: unknown = JSON.parse(await readFile(paths[index]!, 'utf8'))
  const on: unknown = JSON.parse(await readFile(paths[index + 1]!, 'utf8'))
  pairs.push({ disabled: off as typeof pairs[number]['disabled'], enabled: on as typeof pairs[number]['enabled'] })
}
const result = compareSequenceProfilePairs(pairs, Number(budget))
console.log(JSON.stringify({ metric: 'worker edit-to-observation elapsed including headless runtime and output scanning, excluding forced GC and process-tree observation; not pure HMR latency', result }, null, 2))
process.exitCode = result.some(sequence => sequence.status !== 'passed') ? 1 : 0
