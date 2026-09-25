import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { metricsForShard, policy, shards } from './contract.mjs'
import { evaluateGate } from './evaluate.ts'

function evidence(value) {
  return value && Number.isInteger(value.pageCount) && value.pageCount > 0
    && /^[a-f0-9]{64}$/.test(value.templateDigest) && /^[a-f0-9]{64}$/.test(value.configDigest)
}

function pair(batch, ids, requiredPairs) {
  if (!batch || !Array.isArray(batch.samples) || !Array.isArray(batch.errors) || batch.errors.some(e => typeof e !== 'string')) {
    throw new Error('Invalid raw batch')
  }
  const samples = new Map()
  const ownership = new Set()
  let previousOrder = -1
  for (const row of batch.samples) {
    if (!['baseline', 'optimized'].includes(row.side) || !Number.isInteger(row.round) || row.round < 0 || row.round >= requiredPairs || !Array.isArray(row.values)) {
      throw new Error('Invalid sample ownership')
    }
    const rowKey = `${row.side}:${row.round}`
    const order = row.round * 2 + Number(row.side !== (row.round % 2 ? 'optimized' : 'baseline'))
    if (ownership.has(rowKey)) {
      throw new Error('Duplicate sample round')
    }
    if (order <= previousOrder) {
      throw new Error('Sample order must alternate serially by pair')
    }
    ownership.add(rowKey)
    previousOrder = order
    for (const value of row.values) {
      if (!ids.includes(value.id) || !Number.isFinite(value.ms) || value.ms <= 0) {
        throw new Error('Unexpected or invalid raw metric')
      }
      const key = `${row.side}:${row.round}:${value.id}`
      if (samples.has(key)) {
        throw new Error('Duplicate raw metric round')
      }
      samples.set(key, value)
    }
  }
  return ids.map((id) => {
    const pairs = []
    let error
    for (let round = 0; round < requiredPairs; round++) {
      const before = samples.get(`baseline:${round}:${id}`)
      const after = samples.get(`optimized:${round}:${id}`)
      if (!before || !after) {
        error = 'Missing paired sample'
        continue
      }
      if ((id.startsWith('build:') || id.startsWith('auto-build:')) && (!evidence(before.output) || !evidence(after.output) || before.output.pageCount !== after.output.pageCount || before.output.templateDigest !== after.output.templateDigest || before.output.configDigest !== after.output.configDigest)) {
        error = 'Missing or different output evidence'
      }
      pairs.push({ baseline: before.ms, current: after.ms })
    }
    return { id, pairs, requiredPairs, error }
  })
}

export function verifyShard(report, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (report[key] !== value) {
      throw new Error(`Shard identity mismatch: ${key}`)
    }
  }
  const ids = metricsForShard(expected.shard)
  if (JSON.stringify(report.manifest?.metrics) !== JSON.stringify(ids) || JSON.stringify(report.executionPlan?.metrics) !== JSON.stringify(ids)) {
    throw new Error('Shard manifest mismatch')
  }
  const count = expected.shard === 'build' || expected.shard === 'auto-build' ? 7 : 20
  const primary = pair(report.primary, ids, count)
  const initial = evaluateGate(primary)
  const requested = initial.scenarios.filter(r => r.primary.changePercent > 5 && !primary.find(s => s.id === r.id).error && r.primary.count === count).map(r => r.id)
  if (JSON.stringify(report.executionPlan.confirmation) !== JSON.stringify(requested)) {
    throw new Error('Confirmation plan mismatch')
  }
  if (!requested.length && report.confirmation) {
    throw new Error('Unexpected confirmation batch')
  }
  const confirmation = report.confirmation ? pair(report.confirmation, requested, count) : []
  const gate = evaluateGate(primary, confirmation)
  const errors = [...report.primary.errors, ...report.confirmation?.errors ?? []]
  if (errors.length && gate.status !== 'regression') {
    gate.status = 'incomplete'
  }
  if (report.gate?.status !== gate.status) {
    throw new Error('Stored gate differs from raw evidence')
  }
  const featureCosts = []
  if (expected.shard.startsWith('auto-')) {
    for (const side of ['baseline', 'optimized']) {
      for (const id of ids.filter(id => id.includes(':manual:'))) {
        const automatic = id.replace(':manual:', ':automatic:')
        const values = name => Array.from({ length: count }, (_, round) => report.primary.samples.find(row => row.side === side && row.round === round)?.values.find(v => v.id === name)?.ms)
        const summary = evaluateGate([{ id, requiredPairs: count, pairs: values(id).map((v, i) => ({ baseline: v, current: values(automatic)[i] })) }]).scenarios[0].primary
        const extraMs = summary.currentMedianMs === null || summary.baselineMedianMs === null ? null : summary.currentMedianMs - summary.baselineMedianMs
        featureCosts.push({ side, id, complete: summary.count === count && summary.changePercent !== null, manualMedianMs: summary.baselineMedianMs, automaticMedianMs: summary.currentMedianMs, extraMs, changePercent: summary.changePercent, overFeatureBudget: summary.count === count && extraMs > 200 && summary.changePercent > 25 })
      }
    }
  }
  return { gate, errors, featureCosts }
}

export function summarizeStatus(rows) {
  if (rows.includes('regression')) {
    return 'regression'
  }
  if (!rows.length || rows.includes('incomplete')) {
    return 'incomplete'
  }
  return rows.includes('unstable') ? 'unstable' : 'passed'
}

export async function aggregatePlan(plan, root) {
  if (plan.schemaVersion !== 2 || plan.purpose !== 'full' || plan.samplingContract !== policy.samplingContract) {
    throw new Error('Invalid full audit plan')
  }
  const targets = []
  for (const target of plan.targets) {
    const systems = []
    for (const os of policy.operatingSystems) {
      const parts = []
      for (const shard of shards) {
        const entries = plan.matrix.filter(row => row.target === target.id && row.os === os && row.shard === shard)
        try {
          if (entries.length !== 1 || !/^[a-z0-9-]+$/.test(entries[0].artifact)) {
            throw new Error('Missing or duplicate planned shard')
          }
          const content = await readFile(path.join(root, entries[0].artifact, 'report.json'), 'utf8')
          if (content.length > 64 * 1024 * 1024) {
            throw new Error('Oversized shard report')
          }
          const report = JSON.parse(content)
          parts.push({ shard, ...verifyShard(report, { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: plan.driverSha, headSha: target.headSha, baselineSha: target.baselineSha, targetId: target.id, prNumber: target.prNumber, runId: plan.runId, os, shard }) })
        }
        catch (error) {
          parts.push({ shard, gate: { status: 'incomplete', scenarios: [] }, featureCosts: [], errors: [String(error).replaceAll(root, '<artifacts>')] })
        }
      }
      systems.push({ os, status: summarizeStatus(parts.map(p => p.featureCosts.some(c => c.overFeatureBudget) ? 'regression' : p.gate.status)), parts })
    }
    targets.push({ ...target, systems, status: summarizeStatus(systems.map(s => s.status)) })
  }
  return { schemaVersion: 2, purpose: 'full', targets, reused: plan.reused }
}

export function renderTarget(target) {
  const lines = [`### ${target.id}：${target.status === 'passed' ? '✅ 完整性能通过' : `🔴 ${target.status}`}`, '', `HEAD: \`${target.headSha}\`；固定基线: \`${target.baselineSha}\`。`, '', '| OS / 场景 | 首批变化 | 唯一确认 | 结论 |', '| --- | ---: | ---: | --- |']
  for (const system of target.systems) {
    for (const part of system.parts) {
      for (const row of part.gate.scenarios) {
        const format = value => value == null ? '不可用' : `${value.toFixed(2)}%`
        const marker = row.status !== 'passed' ? '🔴 ' : row.primary.changePercent < 0 ? '🟢 ' : ''
        lines.push(`| ${system.os} / ${row.id} | ${marker}${format(row.primary.changePercent)} | ${row.confirmation ? `${row.status === 'passed' ? '' : '🔴 '}${format(row.confirmation.changePercent)}` : '未执行或不完整'} | ${row.status === 'passed' ? '' : '🔴 '}${row.status} |`)
      }
      for (const error of part.errors) {
        lines.push(`\n🔴 ${system.os}/${part.shard}: ${error.replaceAll('\n', ' ').replaceAll('<', '&lt;')}`)
      }
      if (part.featureCosts.length) {
        lines.push('', `#### ${system.os} / ${part.shard} 启用成本`, '', '同提交手动/自动比较，预算同时超过 25% 和 200 ms；与跨提交 5% 门禁分开。', '', '| 提交侧 / 场景 | 手动 P50 | 自动 P50 | 增量 | 增幅 | 功能预算 |', '| --- | ---: | ---: | ---: | ---: | --- |')
        const show = value => value == null ? '不可用' : value.toFixed(2)
        for (const cost of part.featureCosts) {
          const state = !cost.complete ? '🔴 不完整' : cost.overFeatureBudget ? '🔴 越线' : '范围内'
          lines.push(`| ${cost.side} / ${cost.id} | ${show(cost.manualMedianMs)} ms | ${show(cost.automaticMedianMs)} ms | ${show(cost.extraMs)} ms | ${show(cost.changePercent)}% | ${state} |`)
        }
      }
    }
  }
  return lines.join('\n')
}

async function main() {
  const plan = JSON.parse(await readFile(process.env.PERFORMANCE_PLAN, 'utf8'))
  const report = await aggregatePlan(plan, process.env.PERFORMANCE_ARTIFACTS)
  await writeFile('nightly-report.json', JSON.stringify(report))
  const markdown = report.targets.map(renderTarget).join('\n\n') || '无新采样；复用已有记录。'
  await writeFile('nightly-report.md', markdown)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' })
  }
  if (report.targets.some(t => t.status !== 'passed')) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
