import type { DocsContext } from 'repoctl/docs-context'
import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { docsRobots, mergeDocsHeaders } from 'repoctl/docs-context'

/** 让构建器统一写出渠道相关的爬虫策略，保留已有安全响应头。 */
export function docsDeploymentAssets(deployment: DocsContext): Plugin {
  let clientBuild = false
  return {
    name: 'weapp-vite:docs-deployment-assets',
    apply: 'build',
    configResolved(config) {
      clientBuild = !config.build.ssr
    },
    generateBundle() {
      if (!clientBuild) {
        return
      }
      const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: docsRobots(deployment) })
      this.emitFile({ type: 'asset', fileName: '_headers', source: mergeDocsHeaders(headers, deployment) })
    },
  }
}
