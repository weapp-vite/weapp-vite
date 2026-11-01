import type { TemplateAnalysis } from '@weapp-vite/language-service'
import { analyzeTemplate, resolveLanguageProfile } from '@weapp-vite/language-service'
import { getCachedDocumentInput } from '../languages/cache'

const cache = new Map<string, { source: string, platform: string, analysis: TemplateAnalysis }>()

/** 同一次补全或引用查询只扫描一次源码；有界缓存不持有整个工作区。 */
export function getTemplateAnalysis(source: string, fileName = 'component.wxml') {
  const input = getCachedDocumentInput(fileName)
  const platform = input?.platform ?? resolveLanguageProfile(input?.fileName ?? fileName, input?.options)?.platform ?? 'weapp'
  const cached = cache.get(fileName)
  if (cached?.source === source && cached.platform === platform) {
    return cached.analysis
  }
  const analysis = analyzeTemplate({ source, fileName, platform })
  cache.delete(fileName)
  cache.set(fileName, { source, platform, analysis })
  if (cache.size > 8) {
    cache.delete(cache.keys().next().value!)
  }
  return analysis
}
