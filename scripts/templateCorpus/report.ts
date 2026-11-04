import type { CorpusDocument, CorpusManifest, CorpusMetadata } from './types'
import { enforceCorpusPolicy } from './report/policy'

export interface CorpusInventory {
  accepted: boolean
  documents: number
  origins: number
  repositories: number
  nonWechatDocuments: number
  pending: number
  platforms: Record<string, { documents: number, origins: number, native: number, expected: number, generated: number }>
  gaps: string[]
}

/** 数量只按原文哈希去重，来源和平台成员数量独立保留。 */
export function inventoryCorpus(documents: readonly CorpusDocument[], metadata: CorpusMetadata): CorpusInventory {
  const report: CorpusInventory = { accepted: false, documents: documents.length, origins: 0, repositories: 0, nonWechatDocuments: 0, pending: 0, platforms: {}, gaps: [] }
  const repositories = new Map(metadata.repositories.map(repository => [`${repository.repository}@${repository.commit}`, repository]))
  const independent = new Set<string>()
  for (const document of documents) {
    const platforms = new Set<string>()
    const categories = new Set<string>()
    let nonWechat = false
    for (const origin of document.origins) {
      report.origins++
      report.pending += Number(origin.expectation === 'pending')
      const platform = report.platforms[origin.platform] ??= { documents: 0, origins: 0, native: 0, expected: 0, generated: 0 }
      platform.origins++
      platforms.add(origin.platform)
      categories.add(`${origin.platform}:${origin.category}`)
      nonWechat ||= origin.platform !== 'weapp'
      const repository = repositories.get(`${origin.repository}@${origin.commit}`)
      if (repository?.complete) {
        independent.add(repository.independentRepository.toLowerCase())
      }
    }
    for (const platform of platforms) {
      report.platforms[platform]!.documents++
    }
    for (const identity of categories) {
      const [platform, category] = identity.split(':') as [string, 'native' | 'expected' | 'generated']
      report.platforms[platform]![category]++
    }
    report.nonWechatDocuments += Number(nonWechat)
  }
  report.repositories = independent.size
  const enforced = enforceCorpusPolicy(metadata.policy)
  const policy = enforced.policy
  report.gaps.push(...enforced.gaps)
  const minimum = (name: string, count: number, required: number) => {
    if (count < required) {
      report.gaps.push(`${name}: ${count}/${required}`)
    }
  }
  minimum('global unique documents', report.documents, policy.minimumDocuments)
  minimum('independent repositories', report.repositories, policy.minimumRepositories)
  minimum('non-WeChat unique documents', report.nonWechatDocuments, policy.minimumNonWechatDocuments)
  for (const [platform, required] of Object.entries(policy.platformMinimums)) {
    minimum(platform, report.platforms[platform]?.documents ?? 0, required)
  }
  if (report.pending) {
    report.gaps.push(`pending origin classifications: ${report.pending}`)
  }
  for (const repository of metadata.repositories) {
    if (!repository.complete) {
      report.gaps.push(`incomplete frozen source: ${repository.repository}@${repository.commit}`)
    }
  }
  for (const generation of metadata.generations) {
    if (!['built', 'unsupported'].includes(generation.status)) {
      report.gaps.push(`framework cell ${generation.id}: ${generation.status}`)
    }
  }
  report.accepted = report.gaps.length === 0
  return report
}

export function corpusReportMarkdown(manifest: CorpusManifest, report: CorpusInventory): string {
  return [
    '# 全平台模板语料清单',
    '',
    `冻结版本：\`${manifest.id}\`；内容 SHA-256：\`${manifest.contentSha256}\`。`,
    '',
    `全局唯一 ${report.documents}；来源 ${report.origins}；独立仓库 ${report.repositories}；真实非微信唯一 ${report.nonWechatDocuments}。`,
    '',
    '| 平台 | 去重模板 | 原生 | 上游预期 | 实际编译 | 来源 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.platforms).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([platform, row]) => `| ${platform} | ${row.documents} | ${row.native} | ${row.expected} | ${row.generated} | ${row.origins} |`),
    '',
    '各类别、平台成员可以相交，不能相加作为全局唯一数量。词法验证不扩大构建、上传或宿主 runtime 的支持范围。',
    '',
    report.accepted ? '数量与冻结完整性门槛通过；解析、覆盖率、浏览器和性能验收单独报告。' : `验收未完成：\n\n${report.gaps.map(gap => `- ${gap}`).join('\n')}`,
    '',
  ].join('\n')
}
