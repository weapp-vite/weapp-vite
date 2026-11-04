import type { CorpusPolicy } from '../types'
import { corpusPolicy } from '../profiles'

/** 清单只能提高硬门槛；历史或手改清单不能降低仓库约定。 */
export function enforceCorpusPolicy(requested: CorpusPolicy) {
  const gaps: string[] = []
  const threshold = (name: string, value: number | undefined, minimum: number) => {
    if (!Number.isSafeInteger(value) || value! < 0) {
      gaps.push(`invalid manifest policy ${name}: ${String(value)}`)
      return minimum
    }
    if (value! < minimum) {
      gaps.push(`manifest policy below hard minimum ${name}: ${value}/${minimum}`)
    }
    return Math.max(value!, minimum)
  }
  const policy: CorpusPolicy = {
    minimumDocuments: threshold('global unique documents', requested.minimumDocuments, corpusPolicy.minimumDocuments),
    minimumRepositories: threshold('independent repositories', requested.minimumRepositories, corpusPolicy.minimumRepositories),
    minimumNonWechatDocuments: threshold('non-WeChat unique documents', requested.minimumNonWechatDocuments, corpusPolicy.minimumNonWechatDocuments),
    platformMinimums: {},
  }
  for (const platform of new Set([...Object.keys(corpusPolicy.platformMinimums), ...Object.keys(requested.platformMinimums)])) {
    policy.platformMinimums[platform] = threshold(platform, requested.platformMinimums[platform], corpusPolicy.platformMinimums[platform] ?? 0)
  }
  return { policy, gaps }
}
