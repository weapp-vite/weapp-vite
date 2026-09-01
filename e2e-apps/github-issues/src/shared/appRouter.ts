import autoRoutes from 'weapp-vite/auto-routes'
import { createRouter } from 'wevu/router'

let githubIssuesRouterCreated = false

/**
 * @description 初始化 github-issues 应用唯一的 router 实例。
 */
export function ensureGithubIssuesRouter() {
  if (githubIssuesRouterCreated) {
    return
  }

  createRouter({
    // issue-911 fixture 验证的是守卫门控语义，显式保留 blocking。
    initialNavigationMode: 'blocking',
    routes: [
      ...autoRoutes.entries.map(path => ({
        path: `/${path}`,
      })),
    ],
  })

  githubIssuesRouterCreated = true
}
