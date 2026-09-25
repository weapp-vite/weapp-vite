import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const policy = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
export const modes = ['manual', 'automatic']
export const counts = [1, 20, 50, 69]
export const runtimes = ['classic', 'stateful-experimental']
export const shards = [
  'build',
  ...policy.templates.flatMap(t => runtimes.map(runtime => `hmr:${runtime}:${t.id}`)),
  'auto-build',
  'auto-hmr',
]

export function assertSha(sha) {
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Expected a full commit SHA')
  }
  return sha
}

export function metricsForShard(shard) {
  if (!shards.includes(shard)) {
    throw new Error(`Unknown performance shard: ${shard}`)
  }
  if (shard === 'build') {
    return policy.templates.flatMap(t => ['first', 'repeat'].map(p => `build:${t.id}:${p}`))
  }
  if (shard.startsWith('auto-')) {
    const phases = shard === 'auto-build' ? ['first', 'repeat'] : ['first:edit', 'first:restore', 'repeat:edit', 'repeat:restore']
    return counts.flatMap(n => modes.flatMap(m => phases.map(p => `${shard}:${n}:${m}:${p}`)))
  }
  const template = policy.templates.find(t => t.id === shard.split(':')[2])
  return template.scenarios.flatMap(s => ['first', 'repeat'].flatMap(p => ['edit', 'restore'].map(a => `${shard}:${s}:${p}:${a}`)))
}

export function targetKey(target) {
  assertSha(target.headSha)
  assertSha(target.baselineSha)
  return createHash('sha256').update(JSON.stringify([target.headSha, target.baselineSha, policy.samplingContract, policy.templates, policy.operatingSystems, counts, runtimes])).digest('hex')
}

export function statusContext(target) {
  return `Performance Nightly / ${targetKey(target).slice(0, 32)}`
}

export function createMatrix(targets) {
  return targets.flatMap(target => policy.operatingSystems.flatMap(os => shards.map((shard, index) => ({
    target: target.id,
    os,
    shard,
    artifact: `performance-full-${target.id}-${os}-${index}`,
    headSha: target.headSha,
    baselineSha: target.baselineSha,
    headRepository: target.headRepository,
  }))))
}

export function confirmationConfigurations(metrics) {
  return [...new Set(metrics.map(id => id.split(':').slice(0, 3).join(':')))]
}

export function needsSmoke(files) {
  return files.some(file => (/^(?:packages|packages-runtime|mpcore|apps|templates|test|e2e|e2e-apps|scripts|patches)\//.test(file)
    && !/\.(?:md|mdx)$/.test(file))
  || /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|(?:eslint|vitest|tsconfig)[^/]*|\.npmrc)$/.test(file)
  || /^\.github\/(?:actions|scripts|workflows)\//.test(file))
}

/** 冒烟执行完整单配置生命周期，但不生成统计样本对。 */
export function smokeMetrics(shard) {
  return metricsForShard(shard).filter(id => !id.startsWith('auto-') || ['1', '69'].includes(id.split(':')[1]))
}
