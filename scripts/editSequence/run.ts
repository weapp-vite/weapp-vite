import type { EditSequence } from './driver'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { verifyEditSequence } from './driver'
import { EditorSequenceSession } from './editor'
import { createProcessObserver } from './processObserver'
import { createSequenceProject } from './project'
import { buildSequences, compilerSequences, positionDriftSequence } from './scenarios'

const argumentsList = process.argv.slice(2)
const engineIndex = argumentsList.indexOf('--engine')
const engine = engineIndex < 0 ? 'compiler' : argumentsList[engineIndex + 1]
if (!engine || !['compiler', 'editor', 'classic', 'stateful-experimental'].includes(engine)) {
  throw new Error('Usage: node --import tsx scripts/editSequence/run.ts --engine compiler|editor|classic|stateful-experimental [--replay sequence.json]')
}
const replayIndex = argumentsList.indexOf('--replay')
const sequences: EditSequence[] = replayIndex < 0
  ? engine === 'editor' ? [positionDriftSequence] : engine === 'compiler' ? compilerSequences : buildSequences
  : [JSON.parse(await readFile(argumentsList[replayIndex + 1]!, 'utf8')) as EditSequence]
let failed = false
for (const sequence of sequences) {
  const project = await createSequenceProject()
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
      await verifyEditSequence(sequence, createProcessObserver(engine as 'compiler' | 'classic' | 'stateful-experimental', project.root))
    }
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
process.exitCode = failed ? 1 : 0
