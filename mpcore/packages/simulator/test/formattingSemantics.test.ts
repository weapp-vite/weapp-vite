import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FORMATTING_STEPS, formattingCheckpoints } from '../../../../e2e/utils/formattingContract'
import { createFormattingProject, FORMATTING_ROUTES, readFormattingFiles } from '../../../../e2e/utils/formattingProject'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'

let project: string
let files: Array<[string, string]>

beforeAll(async () => {
  project = await createFormattingProject()
  files = await readFormattingFiles(project)
})

afterAll(async () => {
  if (project) {
    await rm(project, { recursive: true, force: true })
  }
})

describe.each(['node', 'browser'] as const)('%s Oxfmt template runtime parity', (provider) => {
  it('preserves control flow, literal whitespace and event bubbling after formatting', async () => {
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath: project })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    const render = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId!, method, event),
      dispatchNativeEvent: (node, eventName, event, onHandlerResult) => session.dispatchNativeNodeEvent(node, eventName, event, onHandlerResult),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    try {
      const observations: unknown[][] = []
      for (const route of FORMATTING_ROUTES) {
        const page = session.reLaunch(route)
        const checkpoints = formattingCheckpoints(route, false)
        const states: unknown[] = []
        for (const [index, step] of FORMATTING_STEPS.entries()) {
          if (step.target) {
            await (await render().$(step.target))!.tap()
          }
          const tree = render()
          for (const node of checkpoints[index]!.nodes) {
            const matches = await tree.$$(node.selector)
            expect(matches, `${route}/${step.id}/${node.selector}`).toHaveLength(node.count ?? 1)
            if (node.text !== undefined) {
              expect(await matches[0]!.text(), `${route}/${step.id}/${node.selector}`).toBe(node.text)
            }
          }
          states.push(JSON.parse(JSON.stringify(page.data)))
        }
        observations.push(states)
      }
      expect(observations[1]).toEqual(observations[0])
    }
    finally {
      session.close()
    }
  })
})
