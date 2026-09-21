import { onLaunch } from 'wevu'
import { createRouter } from 'wevu/router'

let appRouter: ReturnType<typeof createRouter> | undefined
const trace: string[] = []

export function recordIssue1035(event: string) {
  trace.push(event)
  // eslint-disable-next-line no-console -- 真实 IDE 复现需要保留 App 与页面初始化顺序。
  console.log('[issue-1035]', event)
}

export function initializeIssue1035Router() {
  recordIssue1035('app:setup')
  appRouter = createRouter({
    routes: [
      { name: 'issue1035-home', path: '/pages/issue-1035/index' },
      { name: 'issue1035-next', path: '/pages/issue-1035-next/index' },
    ],
  })
  recordIssue1035('app:router-created')
  onLaunch(() => recordIssue1035('app:onLaunch'))
}

export function readIssue1035(router: ReturnType<typeof createRouter>) {
  return {
    sameRouter: router === appRouter,
    target: router.resolve({ name: 'issue1035-next' }).path,
    trace: [...trace],
  }
}
