import type { DocsContext } from 'repoctl/docs-context'
import type { DefaultTheme } from 'vitepress/theme'
import { resolveDocsContext } from 'repoctl/docs-context'
import { siteBaseUrl } from '../site.ts'

export const previewOrigin = 'https://preview.vite.weapp.dev'

export interface DocsThemeConfig extends DefaultTheme.Config {
  docsDeployment: Pick<DocsContext, 'preview' | 'stableOrigin'>
}

/** 构建元数据只决定站点展示；部署授权由 repoctl 文档流程核验。 */
export function getDocsDeployment(channel?: string, url?: string) {
  return resolveDocsContext({ channel, url, previewOrigin, stableOrigin: siteBaseUrl })
}
