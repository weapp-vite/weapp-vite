import type { EditSequence } from './driver'
import type { SequenceStepResult } from './measurement'
import type { SequenceProcessMode } from './processObserver'
import type { SequenceEntryFailure } from './reportLifecycle'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { observeSequenceCandidate } from './candidate'
import { hashSequenceObservation, verifyEditSequence } from './driver'
import { EditorSequenceSession } from './editor'
import { createFrameworkResourceSequence } from './frameworkSequence'
import { createProcessObserver } from './processObserver'
import { readSequenceProfile } from './profileEvidence'
import { createSequenceProject } from './project'
import { completeSequenceEntry, preserveSequenceReport } from './reportLifecycle'
import { assertResourceSequence, createResourceSequence, summarizeResourceSequence } from './resourceSequence'
import { beginSequenceRun } from './runIdentity'
import { buildSequences, compilerSequences, positionDriftSequence } from './scenarios'
import { createWeappModeSequence } from './weappModeScenarios'

const argumentsList = process.argv.slice(2)
const run = beginSequenceRun()
const candidate = await observeSequenceCandidate(path.resolve(import.meta.dirname, '../..'), argumentsList.includes('--require-clean'))
const engineIndex = argumentsList.indexOf('--engine')
const engine = engineIndex < 0 ? 'compiler' : argumentsList[engineIndex + 1]
if (!engine || !['compiler', 'editor', 'classic', 'stateful-experimental', 'weapp-modes', 'weapp-classic', 'weapp-stateful'].includes(engine)) {
  throw new Error('Usage: node --import tsx scripts/editSequence/run.ts --engine compiler|editor|classic|stateful-experimental|weapp-modes|weapp-classic|weapp-stateful [--replay sequence.json] [--resource-cycles 14..120] [--framework-pages 1..512] [--require-clean] [--report report.json]')
}
const fullFramework = engine === 'weapp-classic' || engine === 'weapp-stateful'
const cyclesIndex = argumentsList.indexOf('--resource-cycles')
const pagesIndex = argumentsList.indexOf('--framework-pages')
if (pagesIndex >= 0 && !fullFramework) {
  throw new Error('--framework-pages requires weapp-classic or weapp-stateful')
}
const replayIndex = argumentsList.indexOf('--replay')
const sequences: EditSequence[] = replayIndex < 0
  ? fullFramework ? [createFrameworkResourceSequence(cyclesIndex < 0 ? 14 : Number(argumentsList[cyclesIndex + 1]), pagesIndex < 0 ? 512 : Number(argumentsList[pagesIndex + 1]))] : engine === 'editor' ? [positionDriftSequence] : engine === 'compiler' ? compilerSequences : engine === 'weapp-modes' ? [createWeappModeSequence(true), createWeappModeSequence(false)] : buildSequences
  : [JSON.parse(await readFile(argumentsList[replayIndex + 1]!, 'utf8')) as EditSequence]
if (cyclesIndex >= 0 && !fullFramework) {
  if (engine === 'editor' || engine === 'compiler' || engine === 'weapp-modes') {
    throw new Error('Resource cycles require a build engine')
  }
  sequences.push(createResourceSequence(Number(argumentsList[cyclesIndex + 1])))
}
const reportIndex = argumentsList.indexOf('--report')
const reportFile = reportIndex < 0 ? undefined : argumentsList[reportIndex + 1]
if (reportIndex >= 0 && !reportFile) {
  throw new Error('--report requires a file')
}
const report: Array<{ name: string, inputSha256: string, steps: SequenceStepResult[], status: string, errors?: SequenceEntryFailure[], resources?: ReturnType<typeof summarizeResourceSequence>, childrenAfterClose?: number, profile?: Awaited<ReturnType<typeof readSequenceProfile>> }> = []
let failed = false
await preserveSequenceReport(async () => {
  for (const sequence of sequences) {
    const entry: typeof report[number] = { name: sequence.name, inputSha256: hashSequenceObservation(sequence), steps: [], status: 'failed' }
    report.push(entry)
    let project: Awaited<ReturnType<typeof createSequenceProject>> | undefined
    await completeSequenceEntry(entry, {
      fixtureRoot: () => project?.root ?? path.resolve(import.meta.dirname, '../..'),
      run: async () => {
        project = await createSequenceProject()
        if (engine === 'editor') {
          const session = new EditorSequenceSession()
          await verifyEditSequence(sequence, {
            name: 'volar',
            incremental: async input => session.observe(input.files),
            fresh: async input => new EditorSequenceSession().observe(input.files),
            close: async () => {},
          })
        }
        else {
          const resourceSequence = fullFramework || sequence.name === 'build-warm-resource-trend'
          const observer = createProcessObserver(engine as SequenceProcessMode, project.root, { resources: resourceSequence })
          try {
            await verifyEditSequence(sequence, observer, {
              maxSteps: 120,
              maxFiles: fullFramework ? 1024 : undefined,
              timeoutMs: resourceSequence ? 600_000 : 60_000,
              onStep: step => entry.steps.push(step),
            })
            if (resourceSequence) {
              entry.resources = summarizeResourceSequence(entry.steps)
              assertResourceSequence(entry.resources)
            }
          }
          finally {
            entry.childrenAfterClose = observer.resources?.().children
          }
          if (entry.childrenAfterClose !== 0) {
            throw new Error('Sequence observer retained owned child processes after close')
          }
        }
      },
      profile: async () => {
        if (fullFramework && project) {
          entry.profile = await readSequenceProfile(path.join(project.root, 'incremental'))
        }
      },
      cleanup: async () => {
        await project?.close()
      },
    })
    if (entry.status === 'passed') {
      console.log(`PASS ${engine}: ${sequence.name}`)
    }
    else {
      failed = true
      console.error(`FAIL ${engine}: ${sequence.name}`, entry.errors)
    }
  }
}, reportFile, () => ({
  schemaVersion: 1,
  run: { ...run, clock: { ...run.clock, endedAtMs: performance.now() } },
  engine,
  candidate,
  profileEnabled: Boolean(process.env.WEAPP_VITE_HMR_PROFILE_JSON && !['0', 'false'].includes(process.env.WEAPP_VITE_HMR_PROFILE_JSON)),
  measurementScope: fullFramework ? 'full weapp/Vue/Wevu SFC host and mpcore JS semantics; one persistent compiler worker, independent fresh workers, forced-GC heap and process-tree RSS' : engine === 'weapp-modes' ? 'full weapp build; production bytes after mode/cache transitions, not live edit HMR latency' : 'compiler-native-fixture; hook work and process resources, not framework dirty entries',
  fixtureSfcCounts: sequences.map(sequence => Object.keys(sequence.files).filter(file => file.endsWith('.vue')).length),
  report,
}))
process.exitCode = failed ? 1 : 0
