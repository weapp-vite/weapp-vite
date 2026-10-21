import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 使用原 Turbo 入口冻结实际任务图。
import { execa } from 'execa'
import { localDocument } from './localIo.mjs'

/** 只展开原始的简单 Turbo 包装脚本，不猜测 shell 命令或缩减任务。 */
export async function localDryGraph(root, task, env) {
  let args = task.args.slice(2)
  if (task.args[0] === 'run') {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    const script = manifest.scripts[task.args[1]]
    assert(/^turbo\s/u.test(script) && !/[;&|]/u.test(script), 'Local Turbo wrapper is not a simple existing command')
    args = [...script.trim().split(/\s+/u).slice(1), ...task.args.slice(2)]
  }
  const result = await execa(process.execPath, [createRequire(import.meta.url).resolve('turbo/bin/turbo'), ...args, '--dry=json'], { cwd: path.resolve(root, task.directory), env })
  const graph = JSON.parse(result.stdout)
  assert(Array.isArray(graph.tasks) && graph.tasks.length && new Set(graph.tasks.map(node => node.taskId)).size === graph.tasks.length, 'Local Turbo dry graph is empty or duplicated')
  return graph
}

export async function localTurboSummary(root, output) {
  const candidates = stripVTControlCharacters(output).split('\n').filter(line => line.startsWith('Summary:'))
  assert(candidates.length === 1, 'Local Turbo requires one actual summary marker')
  return await localDocument(root, candidates[0].slice('Summary:'.length).trim(), '.turbo/runs/')
}

/** 缓存命中保留为缓存；只有无脚本节点可以不执行。 */
export function validateLocalTurbo(graph, summary) {
  assert(Array.isArray(graph.tasks) && graph.tasks.length && Array.isArray(summary.tasks), 'Missing local Turbo leaf evidence')
  const planned = graph.tasks.map(node => node.taskId).sort()
  assert(new Set(planned).size === planned.length, 'Duplicate local Turbo planned leaf')
  assert.deepEqual(summary.tasks.map(node => node.taskId).sort(), planned, 'Local Turbo actual leaf set differs from its frozen graph')
  return graph.tasks.map((node) => {
    const actual = summary.tasks.find(item => item.taskId === node.taskId)
    assert(typeof node.command === 'string' && typeof node.hash === 'string' && node.hash
      && actual.command === node.command && actual.hash === node.hash, 'Local Turbo command or input hash changed after graph freeze')
    if (node.command === '<NONEXISTENT>') {
      return [node.taskId, node.command, 'not-executed']
    }
    assert(actual.cache?.status === 'HIT' || (Number.isFinite(actual.execution?.startTime) && actual.execution?.exitCode === 0), 'Local Turbo leaf has no successful actual execution or cache evidence')
    return [node.taskId, node.command, actual.cache?.status === 'HIT' ? 'cached' : 'actual']
  }).sort(([left], [right]) => left.localeCompare(right))
}
