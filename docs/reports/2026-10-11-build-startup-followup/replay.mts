import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { summarizePairs } from '../../../scripts/performanceGate/evaluate'

async function main() {
  const report = JSON.parse(await readFile(new URL('./compiler-native.json', import.meta.url), 'utf8'))
  assert.equal(report.status, 'complete')
  assert.equal(report.completedPairs, 40)
  assert.equal(report.requestedPairs, 40)
  assert.equal(report.pairs.length, 40)
  assert.equal(report.identitiesUnchanged, true)
  assert.deepEqual(report.identity, report.finalIdentity)
  assert.equal(report.timing.length, 10)
  for (const [index, pair] of report.pairs.entries()) {
    assert.equal(pair.pair, index)
    assert.deepEqual(pair.order, index % 2 ? ['on', 'off'] : ['off', 'on'])
    for (const side of ['off', 'on']) {
      assert.equal(pair[side].side, side)
      assert.equal(pair[side].samples.length, 10)
      assert.equal(new Set(pair[side].samples.map((sample: { id: string }) => sample.id)).size, 10)
    }
    for (const a of pair.off.samples) {
      const b = pair.on.samples.find((sample: { id: string }) => sample.id === a.id)
      assert(b)
      assert.match(a.outputSha256, /^[a-f\d]{64}$/)
      assert.equal(a.outputSha256, b.outputSha256)
    }
  }
  for (const row of report.timing) {
    for (const metric of ['wallMs', 'rssBytes']) {
      const pairs = report.pairs.map((pair: Record<string, { samples: Record<string, unknown>[] }>) => {
        const off = pair.off!.samples.find(sample => sample.id === row.id)!
        const on = pair.on!.samples.find(sample => sample.id === row.id)!
        const baseline = Number(off[metric])
        const current = Number(on[metric])
        assert(Number.isFinite(baseline) && baseline > 0 && Number.isFinite(current) && current > 0)
        return { baseline, current }
      })
      assert.deepEqual(summarizePairs(pairs), row[metric])
    }
  }
  process.stdout.write(`${JSON.stringify({ replay: 'passed', pairs: 40, fixtures: 10, scope: 'Warm compiler diagnostic only; no full performance acceptance' })}\n`)
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
