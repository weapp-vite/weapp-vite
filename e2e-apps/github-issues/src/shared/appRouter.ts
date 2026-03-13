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
    routes: [
      ...autoRoutes.entries.map(path => ({
        path: `/${path}`,
      })),
      {
        name: 'issue320-home',
        path: '/pages/issue-320/index',
      },
      {
        name: 'issue320-legacy',
        path: '/pages/issue-320/legacy',
        alias: '/pages/issue-320/legacy-alias',
        redirect: '/pages/issue-320/index?from=legacy',
      },
    ],
  })

  githubIssuesRouterCreated = true
}
