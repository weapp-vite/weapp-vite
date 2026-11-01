import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { FORMATTING_STEPS, formattingCheckpoints } from '../utils/formattingContract'
import { createFormattingProject, FORMATTING_FIXTURE, FORMATTING_ROUTES } from '../utils/formattingProject'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

describe('template Oxfmt runtime semantics', { concurrent: false }, () => {
  let project: string | undefined
  let runtime: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let launchStarted = false

  beforeAll(async () => {
    project = await createFormattingProject()
    const config = JSON.parse(await readFile(path.join(project, 'project.config.json'), 'utf8')) as { appid?: string }
    expect(config.appid).toMatch(/^wx[\da-f]+$/)
    const privateConfig: unknown = JSON.parse(await readFile(path.join(project, 'project.private.config.json'), 'utf8'))
    expect(privateConfig).toHaveProperty('condition.miniprogram.list', expect.arrayContaining(
      FORMATTING_ROUTES.map(route => expect.objectContaining({ pathName: route.slice(1) })),
    ))
    for (const route of FORMATTING_ROUTES) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        await access(path.join(project, `${route.slice(1)}.${extension}`))
      }
    }
    launchStarted = true
    runtime = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: FORMATTING_ROUTES[0],
      warmupRootSelectors: ['#fixture-root'],
    })
  }, 180_000)

  afterAll(async () => {
    // 启动未返回会话时保留 fixture，交由受管 journal 确认资源终结后再回收。
    if (launchStarted && !runtime) {
      return
    }
    await runtime?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('preserves branches, loops, whitespace, bind/catch events and WXSS after real formatting', async (context) => {
    const dom = createDomAcceptance(context, FORMATTING_FIXTURE, FORMATTING_ROUTES.flatMap(route => formattingCheckpoints(route, resolveRuntimeProviderName() === 'devtools')))
    const observations: unknown[][] = []
    for (const route of FORMATTING_ROUTES) {
      const page = await runtime!.reLaunch(route)
      const states: unknown[] = []
      for (const step of FORMATTING_STEPS) {
        if (step.target) {
          await (await page.$(step.target))!.tap()
        }
        await dom.check(`${route}-${step.id}`, runtime!, page)
        states.push(await page.data())
      }
      observations.push(states)
    }
    expect(observations[1]).toEqual(observations[0])
  })
})
