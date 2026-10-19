import { parse } from 'yaml'

const workflowPath = /^\.github\/workflows\/[\w.-]+\.ya?ml$/u
const expression = /\$\{\{.*?\}\}/gsu
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index])
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function labelPattern(job, id) {
  const name = job.name ?? id
  if (typeof name !== 'string' || !name.trim() || /[\r\n]/u.test(name)) {
    throw new Error(`Unsupported workflow job name: ${id}`)
  }
  let pattern = ''
  let offset = 0
  for (const match of name.matchAll(expression)) {
    pattern += `${escape(name.slice(offset, match.index))}[^\\r\\n]+?`
    offset = match.index + match[0].length
  }
  pattern += escape(name.slice(offset))
  // 没有显式 name 时，GitHub 会给已展开的 matrix 名称追加参数。
  return `${pattern}${job.name === undefined && job.strategy?.matrix ? '(?: \\([^\\r\\n]+\\))?' : ''}`
}

function sourceNeeds(job, id, jobs) {
  const needs = job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs]
  if (needs.some(value => typeof value !== 'string' || !Object.hasOwn(jobs, value)) || new Set(needs).size !== needs.length) {
    throw new Error(`Invalid frozen source needs: ${id}`)
  }
  return needs
}

function validateSourceCycles(nodes) {
  const active = new Set()
  const done = new Set()
  const visit = (node) => {
    if (active.has(node)) {
      throw new Error('Frozen workflow contains a needs cycle')
    }
    if (!done.has(node)) {
      active.add(node)
      for (const id of node.needs) {
        visit(node.invocation.jobs.get(id))
      }
      active.delete(node)
      done.add(node)
    }
  }
  nodes.forEach(visit)
}

async function sourceDescriptors(readSource, root) {
  const sources = new Map()
  const nodes = []
  const expand = async (file, parent, stack) => {
    if (!workflowPath.test(file) || stack.includes(file) || stack.length > 16 || nodes.length > 10000) {
      throw new Error(`Unsupported or recursive frozen workflow: ${file}`)
    }
    if (!sources.has(file)) {
      const text = await readSource(file)
      if (typeof text !== 'string') {
        throw new TypeError(`Frozen workflow source must be YAML text: ${file}`)
      }
      const workflow = parse(text)
      if (!object(workflow?.jobs) || !Object.keys(workflow.jobs).length) {
        throw new Error(`Missing frozen workflow jobs: ${file}`)
      }
      sources.set(file, workflow)
    }
    const workflow = sources.get(file)
    const invocation = { parent, jobs: new Map() }
    for (const [id, job] of Object.entries(workflow.jobs)) {
      if (!object(job)) {
        throw new TypeError(`Invalid frozen source job: ${id}`)
      }
      const node = { id, invocation, needs: sourceNeeds(job, id, workflow.jobs), pattern: labelPattern(job, id), leaf: job.uses === undefined }
      node.path = [...(parent?.path ?? []), node]
      node.regex = new RegExp(`^${node.path.map(part => `(${part.pattern})`).join(' / ')}$`, 'u')
      invocation.jobs.set(id, node)
      nodes.push(node)
    }
    validateSourceCycles([...invocation.jobs.values()])
    for (const [id, job] of Object.entries(workflow.jobs)) {
      if (job.uses !== undefined) {
        if (typeof job.uses !== 'string' || !job.uses.startsWith('./') || !workflowPath.test(job.uses.slice(2))) {
          throw new Error(`Unsupported non-local reusable workflow: ${id}`)
        }
        await expand(job.uses.slice(2), invocation.jobs.get(id), [...stack, file])
      }
    }
  }
  await expand(root, null, [])
  return { nodes, sourceFiles: [...sources.keys()].sort() }
}

function matchActualJobs(jobs, nodes) {
  if (!Array.isArray(jobs) || !jobs.length) {
    throw new Error('Missing actual CI jobs')
  }
  const executed = new Map()
  const skipped = new Map()
  const matches = []
  for (const job of jobs) {
    if (typeof job.name !== 'string' || !job.name.trim() || job.status !== 'completed' || !['success', 'skipped'].includes(job.conclusion)) {
      throw new Error('CI topology requires complete successful or skipped actual jobs')
    }
    const candidates = nodes.flatMap((node) => {
      const value = (job.conclusion === 'skipped' || node.leaf) && node.regex.exec(job.name)
      return value ? [{ job, node, labels: value.slice(1) }] : []
    })
    if (!candidates.length) {
      throw new Error(`Unknown actual CI job in frozen source: ${job.name}`)
    }
    if (job.conclusion === 'skipped') {
      skipped.set(job.name, (skipped.get(job.name) ?? 0) + 1)
    }
    else if (executed.has(job.name)) {
      throw new Error(`Duplicate executed CI job name: ${job.name}`)
    }
    else {
      executed.set(job.name, candidates)
    }
    matches.push(...candidates)
  }
  if (!executed.size || [...executed.keys()].some(name => skipped.has(name))) {
    throw new Error('Ambiguous executed and skipped CI job names')
  }
  return { executed, skipped, matches }
}

function dependencyResolver(matches) {
  const inContext = (match, labels) => same(match.labels.slice(0, labels.length), labels)
  function prerequisites(node, labels, active = new Set()) {
    if (!node.needs.length) {
      return node.invocation.parent ? prerequisites(node.invocation.parent, labels.slice(0, -1), active) : []
    }
    return node.needs.flatMap(id => completion(node.invocation.jobs.get(id), labels, active))
  }
  function completion(node, labels, active) {
    if (active.has(node)) {
      throw new Error('Frozen CI topology contains a dependency cycle')
    }
    const descendants = matches.filter(match => match.node.path.includes(node) && inContext(match, labels))
    const successful = descendants.filter(match => match.job.conclusion === 'success')
    if (successful.length) {
      return successful.map(match => match.job.name)
    }
    const skipped = descendants.some(match => match.job.conclusion === 'skipped')
      || matches.some(match => match.job.conclusion === 'skipped' && node.path.includes(match.node)
        && same(match.labels, labels.slice(0, match.labels.length)))
    if (!skipped) {
      throw new Error(`Missing actual dependency evidence for frozen source job: ${node.id}`)
    }
    // skipped 没有执行时长；保留它在源码中的前置约束，不虚构执行节点。
    return prerequisites(node, labels, new Set([...active, node]))
  }
  return match => [...new Set(prerequisites(match.node, match.labels.slice(0, -1)))].sort()
}

function validateActualCycles(needs) {
  const pending = new Set(Object.keys(needs))
  while (pending.size) {
    const ready = [...pending].filter(name => needs[name].every(parent => !pending.has(parent)))
    if (!ready.length) {
      throw new Error('Generated actual CI topology contains a dependency cycle')
    }
    ready.forEach(name => pending.delete(name))
  }
}

/** 只从冻结 YAML 和实际 API jobs 投影依赖；表达式只做名称匹配，绝不执行。 */
export async function generateCiTopology(jobs, readSource, root = '.github/workflows/ci-pr.yml') {
  if (typeof readSource !== 'function') {
    throw new TypeError('Frozen workflow source getter is required')
  }
  const { nodes, sourceFiles } = await sourceDescriptors(readSource, root)
  const { executed, skipped, matches } = matchActualJobs(jobs, nodes)
  const dependencies = dependencyResolver(matches)
  const entries = []
  for (const [name, candidates] of [...executed.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const alternatives = candidates.map(dependencies)
    if (alternatives.some(value => !same(value, alternatives[0]))) {
      throw new Error(`Ambiguous needs in frozen source for actual CI job: ${name}`)
    }
    entries.push([name, alternatives[0]])
  }
  const needs = Object.fromEntries(entries)
  validateActualCycles(needs)
  const outOfScope = Object.fromEntries([...skipped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, expectedCount]) => [name, {
    reason: 'Frozen workflow condition or dependency skipped this actual API job',
    expectedCount,
  }]))
  return { needs, outOfScope, sourceFiles }
}
