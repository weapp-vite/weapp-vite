import type { FrameworkRelease } from '../generate/types'
import type { CorpusGeneration } from '../types'
import { readFrameworkCatalog } from '../generate/catalog'

export interface FrameworkMatrixCell {
  key: string
  framework: string
  version: string
  target: string
  mode: 'development' | 'production'
  expected: 'built' | 'unsupported'
  statuses: CorpusGeneration['status'][]
  evidence: string
  accepted: boolean
}

function key(framework: string, version: string, target: string, mode: string) {
  return `${framework}@${version}/${target}/${mode}`
}

function hasEvidence(generation: CorpusGeneration) {
  return Array.isArray(generation.evidence) && generation.evidence.length > 0 && generation.evidence.every(identity => typeof identity.file === 'string' && identity.file.length > 0 && !identity.file.startsWith('/') && !identity.file.includes('\\') && !identity.file.includes(':') && !identity.file.split('/').includes('..') && /^[\da-f]{64}$/.test(identity.sha256) && Number.isSafeInteger(identity.bytes) && identity.bytes > 0)
}

/** 两种模式的每格都需有结论，不能省略失败目标或伪造不支持声明。 */
export async function auditFrameworkMatrix(generations: readonly CorpusGeneration[], catalog?: readonly FrameworkRelease[]) {
  const releases = catalog ?? await readFrameworkCatalog()
  const byCell = new Map<string, CorpusGeneration[]>()
  const gaps: string[] = []
  for (const generation of generations) {
    const identity = key(generation.framework, generation.version, generation.target, generation.mode)
    const values = byCell.get(identity) ?? []
    values.push(generation)
    byCell.set(identity, values)
  }
  const cells: FrameworkMatrixCell[] = []
  for (const release of releases) {
    for (const target of release.targets) {
      for (const mode of ['development', 'production'] as const) {
        const identity = key(release.framework, release.version, target.target, mode)
        const values = byCell.get(identity) ?? []
        byCell.delete(identity)
        const expected = target.support === 'unsupported' ? 'unsupported' : 'built'
        let accepted = values.length > 0
        if (!values.length) {
          gaps.push(`missing framework cell ${identity}`)
        }
        for (const generation of values) {
          if (generation.status !== expected) {
            gaps.push(`framework cell ${identity}: ${generation.status}, expected ${expected}`)
            accepted = false
          }
          if (!hasEvidence(generation)) {
            gaps.push(`framework cell ${identity}: missing frozen evidence`)
            accepted = false
          }
        }
        if (expected === 'unsupported' && !target.evidence.trim()) {
          gaps.push(`framework cell ${identity}: missing upstream unsupported evidence`)
          accepted = false
        }
        cells.push({ key: identity, framework: release.framework, version: release.version, target: target.target, mode, expected, statuses: values.map(value => value.status), evidence: target.evidence, accepted })
      }
    }
  }
  for (const identity of byCell.keys()) {
    gaps.push(`unregistered framework cell ${identity}`)
  }
  if (!cells.length) {
    gaps.push('empty registered framework matrix')
  }
  return { accepted: gaps.length === 0 && cells.length > 0, cells, gaps }
}

export function frameworkMatrixMarkdown(matrix: Awaited<ReturnType<typeof auditFrameworkMatrix>>) {
  return [
    '',
    '## 编译器冻结矩阵',
    '',
    '| 框架 | 固定版本 | 目标 | 模式 | 要求 | 记录 | 结果 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...matrix.cells.map(cell => `| ${cell.framework} | ${cell.version} | ${cell.target} | ${cell.mode} | ${cell.expected} | ${cell.statuses.join(', ') || 'missing'} | ${cell.accepted ? '通过' : '未完成'} |`),
    '',
    '“不支持”只接受登记上游证据已明确拒绝的版本与目标；候选目标必须有真实构建记录。',
    '',
  ].join('\n')
}
