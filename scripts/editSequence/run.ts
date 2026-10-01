import type { EditSequence } from './driver'
import type { SequenceStepResult } from './measurement'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verifyEditSequence } from './driver'
import { EditorSequenceSession } from './editor'
import { createProcessObserver } from './processObserver'
import { createSequenceProject } from './project'
import { assertResourceSequence, createResourceSequence, summarizeResourceSequence } from './resourceSequence'
import { buildSequences, compilerSequences, positionDriftSequence } from './scenarios'

const argumentsList = process.argv.slice(2)
const engineIndex = argumentsList.indexOf('--engine')
const engine = engineIndex < 0 ? 'compiler' : argumentsList[engineIndex + 1]
if (!engine || !['compiler', 'editor', 'classic', 'stateful-experimental'].includes(engine)) {
  throw new Error('Usage: node --import tsx scripts/editSequence/run.ts --engine compiler|editor|classic|stateful-experimental [--replay sequence.json] [--resource-cycles 14..120] [--report report.json]')
}
const replayIndex = argumentsList.indexOf('--replay')
const sequences: EditSequence[] = replayIndex < 0
  ? engine === 'editor' ? [positionDriftSequence] : engine === 'compiler' ? compilerSequences : buildSequences
  : [JSON.parse(await readFile(argumentsList[replayIndex + 1]!, 'utf8')) as EditSequence]
const cyclesIndex = argumentsList.indexOf('--resource-cycles')
if (cyclesIndex >= 0) {
  if (engine === 'editor' || engine === 'compiler') {
    throw new Error('Resource cycles require a build engine')
  }
  sequences.push(createResourceSequence(Number(argumentsList[cyclesIndex + 1])))
}
const reportIndex = argumentsList.indexOf('--report')
const reportFile = reportIndex < 0 ? undefined : argumentsList[reportIndex + 1]
if (reportIndex >= 0 && !reportFile) {
  throw new Error('--report requires a file')
}
const report: Array<{ name: string, steps: SequenceStepResult[], status: string, resources?: ReturnType<typeof summarizeResourceSequence>, childrenAfterClose?: number }> = []
let failed = false
for (const sequence of sequences) {
  const project = await createSequenceProject()
  const entry: typeof report[number] = { name: sequence.name, steps: [], status: 'failed' }
  report.push(entry)
  try {
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
      const observer = createProcessObserver(engine as 'compiler' | 'classic' | 'stateful-experimental', project.root)
      try {
        await verifyEditSequence(sequence, observer, {
          maxSteps: 120,
          timeoutMs: cyclesIndex < 0 ? 60_000 : 600_000,
          onStep: step => entry.steps.push(step),
        })
        if (sequence.name === 'build-warm-resource-trend') {
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
    entry.status = 'passed'
    console.log(`PASS ${engine}: ${sequence.name}`)
  }
  catch (error) {
    failed = true
    console.error(error)
  }
  finally {
    await project.close()
  }
}
if (reportFile) {
  await mkdir(path.dirname(reportFile), { recursive: true })
  await writeFile(reportFile, `${JSON.stringify({ schemaVersion: 1, engine, measurementScope: 'compiler-native-fixture; hook work and process resources, not framework dirty entries', report }, null, 2)}\n`)
}
process.exitCode = failed ? 1 : 0
