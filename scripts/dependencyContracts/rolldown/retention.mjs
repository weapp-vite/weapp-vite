import assert from 'node:assert/strict'
import process from 'node:process'
import { diagnosticGc, fixture } from './helpers.mjs'

function createLogger(sentinel) {
  return function logger(level, log, defaultHandler) {
    assert.ok(sentinel.label)
    defaultHandler(level, log)
  }
}

function createSelfSavingPlugin(observations, label) {
  let savedInput
  let savedOutput
  return {
    name: 'snapshot-self-saving-plugin',
    buildStart(input) {
      savedInput = input
      input.marker = label
      observations.input.push({ label, ref: new WeakRef(input) })
    },
    renderStart(output) {
      savedOutput = output
      output.marker = label
      observations.output.push({ label, ref: new WeakRef(output) })
    },
    buildEnd() { assert.equal(savedInput.marker, label) },
    closeBundle() {
      assert.equal(savedInput.marker, label)
      assert.equal(savedOutput.marker, label)
    },
  }
}

function createInput(files, observations, label) {
  const sentinel = { label }
  observations.sentinel.push({ label, ref: new WeakRef(sentinel) })
  return { input: files.entry, cwd: files.cwd, preserveEntrySignatures: 'strict', plugins: [createSelfSavingPlugin(observations, label)], onLog: createLogger(sentinel) }
}

async function round(rolldown, files, observations, label) {
  const bundle = await rolldown(createInput(files, observations, label))
  observations.bundle.push({ label, ref: new WeakRef(bundle) })
  try {
    await bundle.generate({ format: 'es' })
  }
  finally {
    await bundle.close()
  }
  assert.equal(bundle.closed, true)
}

export async function retention(rolldown, root) {
  const files = await fixture(root, 'retention')
  const observations = { input: [], output: [], sentinel: [], bundle: [] }
  for (let index = 1; index <= 3; index++) {
    await round(rolldown, files, observations, `self-saved:${index}`)
  }
  const beforeGc = process.memoryUsage()
  await diagnosticGc()
  const afterGc = process.memoryUsage()
  const live = Object.fromEntries(Object.entries(observations).map(([kind, entries]) => [kind, entries.filter(item => item.ref.deref()).map(item => item.label)]))
  for (const [kind, labels] of Object.entries(live)) {
    assert.deepEqual(labels, [], `Closed bundle retained ${kind}`)
  }
  return { live, beforeGc, afterGc, note: 'Memory samples are diagnostic; reference release is required' }
}
