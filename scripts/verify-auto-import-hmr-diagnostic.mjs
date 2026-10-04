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
    const deterministicOutputsEqual = manifestsEqualExcludingControl(checkpoint.control.files, checkpoint.probe.files)
    const sessionControlContractEqual = contractShapeEqual(checkpoint.control.controlContract, checkpoint.probe.controlContract)
    compareManifests(count, checkpoint.name, checkpoint.control.files, checkpoint.probe.files, failures)
    comparisons.push({ count, checkpoint: checkpoint.name, deterministicOutputsEqual, sessionControlContractEqual })
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
  return paths.filter(file => file !== '__weapp_vite_hmr/control.js').every(file => control[file]?.bytes === probe[file]?.bytes && control[file]?.sha256 === probe[file]?.sha256)
}

const result = { schemaVersion: 1, equivalence: 'deterministic outputs excluding control.js are byte-identical; complete control.js source is identical after replacing only buildId, token, and dynamic port literals; both files match their independently registered session', comparisons, failures }
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
    if (control[file]?.bytes !== probe[file]?.bytes || control[file]?.sha256 !== probe[file]?.sha256) {
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
