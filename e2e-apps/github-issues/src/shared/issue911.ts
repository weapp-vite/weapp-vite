import { useRouter } from 'wevu/router'

const ISSUE_911_ROUTE = 'pages/issue-911/index'
const trace: string[] = []
let guardInstalled = false

export function ensureIssue911Guard() {
  if (guardInstalled) {
    return
  }

  guardInstalled = true
  useRouter().beforeEach(async (to) => {
    if (to.path.replace(/^\/+/, '') !== ISSUE_911_ROUTE) {
      return
    }

    trace.push('beforeEach:start')
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    trace.push('beforeEach:done')
  })
}

export function recordIssue911Mounted() {
  trace.push('mounted')
}

export function readIssue911Trace() {
  return [...trace]
}
