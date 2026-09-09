import type { TestContext } from 'vitest'
import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { createDomAcceptance } from '../../utils/domAcceptance'
import { getSharedMiniProgram, relaunchPage } from '../github-issues.runtime.shared'

export { githubText } from './nodes'

export interface GithubDomStep extends Omit<DomCheckpoint, 'route'> {
  tap?: string
  method?: string
  args?: unknown[]
}

export async function runGithubDom(context: TestContext, route: string, steps: GithubDomStep[]) {
  const dom = createDomAcceptance(context, 'e2e-apps/github-issues', steps.map(step => ({ ...step, route })))
  const miniProgram = await getSharedMiniProgram(context)
  const page = await relaunchPage(miniProgram, route, undefined, 45_000, { readiness: 'route', forceRelaunch: true })
  if (!page) {
    throw new Error(`Failed to open GitHub regression page: ${route}`)
  }
  for (const step of steps) {
    if (step.tap) {
      const nodes = await page.$$(step.tap, { fallback: false, timeout: 5_000 })
      if (nodes.length !== 1) {
        throw new Error(`Expected one GitHub regression control: ${step.tap}`)
      }
      await nodes[0].tap()
    }
    if (step.method) {
      await page.callMethod(step.method, ...(step.args ?? []))
    }
    await dom.check(step.id, miniProgram, page)
  }
}
