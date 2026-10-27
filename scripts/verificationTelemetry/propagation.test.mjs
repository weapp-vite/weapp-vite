import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { expect, it } from 'vitest'
import YAML from 'yaml'

const root = new URL('../../', import.meta.url)
const wrappers = ['reusable-node-command', 'reusable-miniapp-platform', 'reusable-quality-platform', 'reusable-consumer-platform']
const entries = ['validate-ci', 'validate-ci-e2e', 'validate-ci-vite-host-consumer']
const workflowPath = name => `.github/workflows/${name}.yml`
const files = [...wrappers, ...entries].map(workflowPath)
const entryFiles = new Set(entries.map(workflowPath))
const inherited = `\${{ inputs.verification_topology }}`
const topologyEnv = 'WEAPP_VITE_VERIFICATION_TOPOLOGY'
const input = { required: false, type: 'string', default: 'optimized-v1' }
const actual = Object.fromEntries(await Promise.all(files.map(async file => [file, YAML.parse(await fs.readFile(new URL(file, root), 'utf8'))])))
const snapshots = Object.fromEntries(await Promise.all(['baseline', 'candidate'].map(async variant => [variant, JSON.parse(await fs.readFile(new URL(`./${variant}-topology.json`, import.meta.url), 'utf8'))])))

function graphWithJobs(snapshot) {
  return Object.fromEntries(files.map(file => [file, { ...structuredClone(actual[file]), jobs: structuredClone(snapshot[file]) }]))
}

function assertTopologyGraph(workflows, selection, fixedEntry = false) {
  const visited = new Set()
  const direct = new Set()
  function visit(file, topology, ancestors = []) {
    assert(!ancestors.includes(file), `Reusable workflow cycle: ${file}`)
    const workflow = workflows[file]
    assert(workflow, `Unsupported topology workflow: ${file}`)
    assert.deepEqual(workflow.on.workflow_call.inputs.verification_topology, input, `Topology input: ${file}`)
    visited.add(file)
    const expected = entryFiles.has(file) && fixedEntry ? selection : inherited
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const label = `${file}:${id}`
      if (job.uses === './.github/workflows/reusable-frozen-pr-context.yml') {
        assert.equal(job.with?.verification_topology, fixedEntry ? undefined : inherited, `Frozen context schema: ${label}`)
      }
      else if (job.uses) {
        const target = job.uses.replace(/^\.\//, '')
        assert(workflows[target], `Unsupported topology call: ${label}`)
        assert.equal(job.with?.verification_topology, expected, `Topology call: ${label}`)
        const childTopology = job.with.verification_topology === inherited ? topology : job.with.verification_topology
        assert.equal(childTopology, topology, `Topology call identity: ${label}`)
        visit(target, childTopology, [...ancestors, file])
      }
      else if (job['runs-on']) {
        direct.add(label)
        assert.equal(job.env?.[topologyEnv], expected, `Topology environment: ${label}`)
        assert.equal(job.env[topologyEnv] === inherited ? topology : job.env[topologyEnv], topology, `Topology job identity: ${label}`)
      }
      else {
        assert.fail(`Unsupported topology job: ${label}`)
      }
    }
  }
  for (const file of entryFiles) {
    visit(file, selection)
  }
  if (!fixedEntry) {
    assert.deepEqual([...visited].sort(), [...files].sort(), 'Every candidate wrapper must be reachable')
  }
  for (const file of files) {
    if (!visited.has(file)) {
      visit(file, selection)
    }
  }
  return [...direct].sort()
}

it('transports the ordinary optimized default through every nested workflow and native execution job', () => {
  expect(assertTopologyGraph(actual, 'optimized-v1')).toEqual([
    'reusable-consumer-platform:node-support',
    'reusable-consumer-platform:node-support-v2',
    'reusable-consumer-platform:node-support-aggregate-v2',
    'reusable-consumer-platform:consumer-aggregate-v2',
    'reusable-miniapp-platform:aggregate',
    'reusable-miniapp-platform:ide-dom-headless-aggregate',
    'reusable-miniapp-platform:plan',
    'reusable-node-command:run',
    'reusable-quality-platform:coverage-merge',
    'validate-ci-vite-host-consumer:chokidar-delivery-windows',
  ].map(label => label.replace(':', '.yml:')).map(label => `.github/workflows/${label}`).sort())
})

it.each(['optimized-v1', 'optimized-v2', 'legacy-v1'])('keeps an explicit %s identity through the common wrappers', (selection) => {
  assertTopologyGraph(actual, selection)
})

it('freezes the derived baseline as explicit legacy while the candidate inherits the optimized default', () => {
  expect(assertTopologyGraph(graphWithJobs(snapshots.baseline), 'legacy-v1', true)).toHaveLength(7)
  expect(assertTopologyGraph(graphWithJobs(snapshots.candidate), 'optimized-v1')).toHaveLength(10)
})

const transports = files.flatMap(file => Object.entries(actual[file].jobs).flatMap(([id, job]) => {
  if (job.with?.verification_topology) {
    return [{ file, id, kind: 'call' }]
  }
  if (job.env?.[topologyEnv]) {
    return [{ file, id, kind: 'environment' }]
  }
  return []
}))

it.each(transports)('rejects a missing $kind transport at $file:$id', ({ file, id, kind }) => {
  const graph = structuredClone(actual)
  const job = graph[file].jobs[id]
  if (kind === 'call') {
    delete job.with.verification_topology
  }
  else {
    delete job.env[topologyEnv]
  }
  const frozenContext = actual[file].jobs[id].uses === './.github/workflows/reusable-frozen-pr-context.yml'
  expect(() => assertTopologyGraph(graph, 'optimized-v1')).toThrow(frozenContext ? 'Frozen context schema:' : /Topology (call|environment):/)
})

it.each(['call', 'environment', 'default', 'frozen context', 'unknown workflow'])('rejects an opposite or unsupported %s boundary', (change) => {
  const graph = structuredClone(actual)
  if (change === 'call') {
    graph[workflowPath('reusable-quality-platform')].jobs.build.with.verification_topology = 'legacy-v1'
  }
  else if (change === 'environment') {
    graph[workflowPath('reusable-node-command')].jobs.run.env[topologyEnv] = 'legacy-v1'
  }
  else if (change === 'default') {
    graph[workflowPath('reusable-miniapp-platform')].on.workflow_call.inputs.verification_topology.default = 'legacy-v1'
  }
  else if (change === 'frozen context') {
    graph[workflowPath('validate-ci')].jobs['pr-context'].with.verification_topology = 'legacy-v1'
  }
  else {
    graph[workflowPath('validate-ci')].jobs['build-pr'].uses = './.github/workflows/unknown.yml'
  }
  expect(() => assertTopologyGraph(graph, 'optimized-v1')).toThrow(/Topology|Frozen context|Unsupported topology/)
})

it('rejects an optimized call inserted into the explicit legacy baseline', () => {
  const graph = graphWithJobs(snapshots.baseline)
  graph[workflowPath('validate-ci')].jobs['build-pr'].with.verification_topology = 'optimized-v1'
  expect(() => assertTopologyGraph(graph, 'legacy-v1', true)).toThrow('Topology call:')
})
