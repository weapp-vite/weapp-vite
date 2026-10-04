import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(process.argv[2] ?? '')
const failures = []
const comparisons = []
if (!process.argv[2]) {
  throw new Error('Usage: node scripts/verify-auto-import-hmr-diagnostic.mjs <diagnostic-root>')
}
for (const count of [50, 69]) {
  const controlPath = path.join(root, 'candidate', 'control', 'report.json')
  const probePath = path.join(root, 'candidate', 'probe', 'report.json')
  const [controlReport, probeReport] = await Promise.all([readJson(controlPath), readJson(probePath)])
  const control = controlReport.results?.find(result => result.usedCount === count)?.raw?.manual?.[0]?.pairEvidence
  const probe = probeReport.results?.find(result => result.usedCount === count)?.raw?.manual?.[0]?.pairEvidence
  if (!control || !probe || control.phase !== 'control' || probe.phase !== 'probe') {
    failures.push({ count, checkpoint: 'reports', reason: 'missing or mismatched control/probe evidence' })
    continue
  }
  for (const checkpoint of checkpointPairs(control, probe)) {
    const canonicalOutputsEqual = manifestsEqualExcludingControl(checkpoint.control.files, checkpoint.probe.files)
    const allOriginalOutputBytesIdentical = manifestsEqual(checkpoint.control.files, checkpoint.probe.files)
    const sessionControlContractEqual = contractShapeEqual(checkpoint.control.controlContract, checkpoint.probe.controlContract)
    compareManifests(count, checkpoint.name, checkpoint.control.files, checkpoint.probe.files, failures)
    comparisons.push({ count, checkpoint: checkpoint.name, canonicalOutputsEqual, allOriginalOutputBytesIdentical, sessionControlContractEqual })
    if (!sessionControlContractEqual) {
      failures.push({ count, checkpoint: checkpoint.name, reason: 'session control contract shape differs' })
    }
  }
}

function manifestsEqualExcludingControl(control, probe) {
  if (!control || !probe) {
    return false
  }
  const paths = Object.keys(control).sort()
  if (JSON.stringify(paths) !== JSON.stringify(Object.keys(probe).sort())) {
    return false
  }
  return paths.filter(file => file !== '__weapp_vite_hmr/control.js').every(file => filesEquivalent(control[file], probe[file]))
}

function manifestsEqual(control, probe) {
  if (!control || !probe) {
    return false
  }
  const paths = Object.keys(control).sort()
  return JSON.stringify(paths) === JSON.stringify(Object.keys(probe).sort())
    && paths.every(file => control[file]?.bytes === probe[file]?.bytes && control[file]?.sha256 === probe[file]?.sha256)
}

function filesEquivalent(control, probe) {
  const normalizedKinds = new Set([
    'registered-stateful-build-id-first-line',
    'registered-stateful-hmr-batch-nonce-and-build-id',
  ])
  if (normalizedKinds.has(control?.normalized) || normalizedKinds.has(probe?.normalized)) {
    return control?.normalized === probe?.normalized
      && normalizedKinds.has(control?.normalized)
      && Number.isFinite(control.canonicalBytes)
      && Number.isInteger(control.canonicalBytes)
      && control.canonicalBytes >= 0
      && Number.isFinite(probe.canonicalBytes)
      && Number.isInteger(probe.canonicalBytes)
      && probe.canonicalBytes >= 0
      && typeof control.canonicalSha256 === 'string'
      && /^[a-f0-9]{64}$/i.test(control.canonicalSha256)
      && typeof probe.canonicalSha256 === 'string'
      && /^[a-f0-9]{64}$/i.test(probe.canonicalSha256)
      && control.canonicalBytes === probe.canonicalBytes
      && control.canonicalSha256 === probe.canonicalSha256
  }
  return control?.bytes === probe?.bytes && control?.sha256 === probe?.sha256
}

const result = { schemaVersion: 1, equivalence: 'all non-control outputs match byte-for-byte except JS chunks with the exact registered build-ID first-line stamp and update.js batches with the exact generated wrapper and registered buildId metadata. Their canonical full-file hashes replace only the chunk stamp, or only the batch nonce and metadata buildId; all remaining metadata, body, and inline map bytes remain compared. Raw hashes are retained, and allOriginalOutputBytesIdentical reports whether every original output file, including control.js, was byte-identical. Complete control.js source is separately checked against each registered session after replacing only buildId, token, and dynamic port literals.', comparisons, failures }
await writeFile(path.join(root, 'equivalence.json'), `${JSON.stringify(result, null, 2)}\n`)
if (failures.length) {
  throw new Error(`Control/probe dist equivalence failed: ${failures.length} discrepancy(s)`)
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function checkpointPairs(control, probe) {
  const pairs = [{ name: 'initial', control: control.initial, probe: probe.initial }]
  for (let index = 0; index < 2; index++) {
    const controlCycle = control.cycles?.[index]
    const probeCycle = probe.cycles?.[index]
    if (!controlCycle || !probeCycle) {
      throw new Error(`Missing cycle ${index + 1} for ${control.fixtureKey}`)
    }
    pairs.push({ name: `cycle-${index + 1}-edit`, control: controlCycle.edit, probe: probeCycle.edit })
    pairs.push({ name: `cycle-${index + 1}-restore`, control: controlCycle.restore, probe: probeCycle.restore })
  }
  return pairs
}

function compareManifests(count, checkpoint, control, probe, failures) {
  if (!control || !probe) {
    failures.push({ count, checkpoint, reason: 'missing manifest' })
    return
  }
  const controlPaths = Object.keys(control).sort()
  const probePaths = Object.keys(probe).sort()
  if (JSON.stringify(controlPaths) !== JSON.stringify(probePaths)) {
    failures.push({ count, checkpoint, reason: 'file sets differ', controlOnly: controlPaths.filter(file => !probe[file]), probeOnly: probePaths.filter(file => !control[file]) })
  }
  for (const file of controlPaths.filter(file => file !== '__weapp_vite_hmr/control.js')) {
    if (!filesEquivalent(control[file], probe[file])) {
      failures.push({ count, checkpoint, file, reason: 'deterministic output differs' })
    }
  }
}

function contractShapeEqual(control, probe) {
  if (!control || !probe) {
    return false
  }
  return control.schemaValid === probe.schemaValid
    && control.registeredSessionMatches === true
    && probe.registeredSessionMatches === true
    && control.buildIdShape === probe.buildIdShape
    && control.tokenShape === probe.tokenShape
    && JSON.stringify(control.url) === JSON.stringify(probe.url)
    && JSON.stringify(control.references) === JSON.stringify(probe.references)
    && control.canonicalSourceBytes === probe.canonicalSourceBytes
    && control.canonicalSourceSha256 === probe.canonicalSourceSha256
    && control.sessionFieldFingerprints?.buildId !== probe.sessionFieldFingerprints?.buildId
    && control.sessionFieldFingerprints?.token !== probe.sessionFieldFingerprints?.token
}
