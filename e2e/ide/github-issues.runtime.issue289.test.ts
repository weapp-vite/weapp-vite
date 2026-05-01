import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readClassName,
  readFirstClassFromWxmlByToken,
  readPageWxml,
  relaunchPage,
  tapControlAndReadClass,
} from './github-issues.runtime.shared'

async function runIssue289Step<T>(label: string, task: () => Promise<T>, timeoutMs = 10_000) {
  return await Promise.race([
    task(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`issue289 step timed out: ${label} (${timeoutMs}ms)`))
      }, timeoutMs)
    }),
  ])
}

describe.sequential('e2e app: github-issues / issue-289', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  })

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  async function withIssue289Page<T>(
    ctx: any,
    route: string,
    readyText: string,
    label: string,
    run: (page: any) => Promise<T>,
  ) {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, route, readyText, 30_000)
    if (!page) {
      throw new Error(`Failed to launch ${label} page`)
    }
    return await run(page)
  }

  it('issue #289: updates runtime classes on object-literal page', async (ctx) => {
    await withIssue289Page(
      ctx,
      '/pages/issue-289/object-literal/index',
      'object-list-loose',
      'object-literal',
      async (objectPage) => {
        const objectInitialWxml = await readPageWxml(objectPage)
        expect(objectInitialWxml).toContain('object-list-loose')
        expect(objectInitialWxml).not.toContain('object list hidden')

        const objectResult = await runIssue289Step('object-literal runE2E', () => objectPage.callMethod('runE2E'))
        await objectPage.waitFor(400)
        expect(objectResult?.ok).toBe(true)
        expect(objectResult?.checks?.compactChanged).toBe(true)
        expect(objectResult?.checks?.activeChanged).toBe(true)
        expect(objectResult?.checks?.showListRoundTripWorked).toBe(true)
        expect(objectResult?.checks?.finalListVisible).toBe(true)
        expect(objectResult?.state?.compactMode).toBe(true)
        expect(objectResult?.state?.showList).toBe(true)
        expect(objectResult?.state?.activeIndex).toBe(1)

        const objectUpdatedWxml = await readPageWxml(objectPage)
        expect(objectUpdatedWxml).toContain('object-list-compact')
        expect(objectUpdatedWxml).not.toContain('object-list-loose')
        expect(objectUpdatedWxml).not.toContain('object list hidden')
        expect(objectUpdatedWxml).toContain('激活项：item-1')
      },
    )
  })

  it('issue #289: updates runtime classes on map-class page', async (ctx) => {
    await withIssue289Page(
      ctx,
      '/pages/issue-289/map-class/index',
      'issue289-map-toggle-expanded',
      'map-class',
      async (mapPage) => {
        const mapInitialWxml = await readPageWxml(mapPage)
        expect(mapInitialWxml).toContain('issue289-map-toggle-expanded issue289-ctrl-on')
        expect(mapInitialWxml).toContain('issue289-map-toggle-list issue289-ctrl-on')
        expect(mapInitialWxml).toContain('issue289-map-cycle-selected issue289-cycle-1')
        expect(mapInitialWxml).toContain('map-meta-list-open')
        const mapListControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-list')
        const mapExpandedControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-expanded')
        expect(mapListControlOnClass).toContain('issue289-ctrl-on')
        expect(mapExpandedControlOnClass).toContain('issue289-ctrl-on')

        const mapMetaListOnClass = readFirstClassFromWxmlByToken(mapInitialWxml, 'map-meta-list')
        expect(mapMetaListOnClass).toContain('map-meta-list-open')
        expect(mapMetaListOnClass).not.toContain('map-meta-list-closed')

        const mapExpandedControlOffClass = await tapControlAndReadClass(
          mapPage,
          '.issue289-map-switch-expanded',
          '.issue289-map-toggle-expanded',
        )
        expect(mapExpandedControlOffClass).toContain('issue289-ctrl-off')
        expect(mapExpandedControlOffClass).not.toContain('issue289-ctrl-on')

        const mapExpandedOffWxml = await readPageWxml(mapPage)
        expect(mapExpandedOffWxml).toContain('map-meta-list-open')

        const mapListControlOffClass = await tapControlAndReadClass(
          mapPage,
          '.issue289-map-switch-list',
          '.issue289-map-toggle-list',
        )
        expect(mapListControlOffClass).toContain('issue289-ctrl-off')
        expect(mapListControlOffClass).not.toContain('issue289-ctrl-on')

        const mapListOffWxml = await readPageWxml(mapPage)
        const mapMetaListOffClass = readFirstClassFromWxmlByToken(mapListOffWxml, 'map-meta-list')
        expect(mapMetaListOffClass).toContain('map-meta-list-closed')
        expect(mapMetaListOffClass).not.toContain('map-meta-list-open')
        expect(mapListOffWxml).not.toContain('event-chip-expanded')
        expect(mapListOffWxml).toContain('callout hidden')

        const mapListControlOnClassAfter = await tapControlAndReadClass(
          mapPage,
          '.issue289-map-switch-list',
          '.issue289-map-toggle-list',
        )
        expect(mapListControlOnClassAfter).toContain('issue289-ctrl-on')
        expect(mapListControlOnClassAfter).not.toContain('issue289-ctrl-off')

        const mapListOnWxml = await readPageWxml(mapPage)
        const mapMetaListOnClassAfter = readFirstClassFromWxmlByToken(mapListOnWxml, 'map-meta-list')
        expect(mapMetaListOnClassAfter).toContain('map-meta-list-open')
        expect(mapMetaListOnClassAfter).not.toContain('map-meta-list-closed')
        expect(mapListOnWxml).not.toContain('callout hidden')

        const mapExpandedControlOnClassAfter = await tapControlAndReadClass(
          mapPage,
          '.issue289-map-switch-expanded',
          '.issue289-map-toggle-expanded',
        )
        expect(mapExpandedControlOnClassAfter).toContain('issue289-ctrl-on')
        expect(mapExpandedControlOnClassAfter).not.toContain('issue289-ctrl-off')
        const mapExpandedOnWxml = await readPageWxml(mapPage)
        expect(mapExpandedOnWxml).toContain('map-meta-list-open')
      },
    )
  })

  it('issue #289: updates runtime classes on root-class page', async (ctx) => {
    await withIssue289Page(
      ctx,
      '/pages/issue-289/root-class/index',
      'root class: aaaa',
      'root-class',
      async (rootPage) => {
        const rootInitialWxml = await readPageWxml(rootPage)
        expect(rootInitialWxml).toContain('root class: aaaa')

        const rootResult = await runIssue289Step('root-class runE2E', () => rootPage.callMethod('runE2E'))
        await rootPage.waitFor(400)
        expect(rootResult?.ok).toBe(true)
        expect(rootResult?.checks?.selectedIndexChanged).toBe(true)
        expect(rootResult?.checks?.showOptionsChanged).toBe(true)
        expect(rootResult?.state?.showOptions).toBe(false)
        expect(rootResult?.state?.selectedIndex).toBe(1)

        const rootUpdatedWxml = await readPageWxml(rootPage)
        expect(rootUpdatedWxml).toContain('root class: bbbb')
        expect(rootUpdatedWxml).toContain('options hidden')
        expect(rootUpdatedWxml).toContain('选中类：root-b')
      },
    )
  })

  it('issue #289: updates runtime classes on computed-class page', async (ctx) => {
    await withIssue289Page(
      ctx,
      '/pages/issue-289/computed-class/index',
      'issue289-computed-toggle-source',
      'computed-class',
      async (computedPage) => {
        const computedInitialWxml = await readPageWxml(computedPage)
        expect(computedInitialWxml).toContain('issue289-computed-toggle-source issue289-ctrl-on')
        expect(computedInitialWxml).toContain('issue289-computed-toggle-items issue289-ctrl-on')
        expect(computedInitialWxml).toContain('issue289-computed-cycle-selected issue289-cycle-0')

        const computedSourceOnClass = await readClassName(computedPage, '.issue289-computed-toggle-source')
        const computedItemsOnClass = await readClassName(computedPage, '.issue289-computed-toggle-items')
        expect(computedSourceOnClass).toContain('issue289-ctrl-on')
        expect(computedItemsOnClass).toContain('issue289-ctrl-on')
        const computedListOnClass = readFirstClassFromWxmlByToken(computedInitialWxml, 'computed-list')
        expect(computedListOnClass).toContain('computed-list')
        expect(
          computedListOnClass.includes('computed-list-enabled')
          || computedListOnClass.includes('computed-list-disabled'),
        ).toBe(true)

        const computedSourceOffClass = await tapControlAndReadClass(
          computedPage,
          '.issue289-computed-switch-source',
          '.issue289-computed-toggle-source',
        )
        expect(computedSourceOffClass).toContain('issue289-ctrl-off')
        expect(computedSourceOffClass).not.toContain('issue289-ctrl-on')

        const computedSourceOffWxml = await readPageWxml(computedPage)
        const computedListDisabledClass = readFirstClassFromWxmlByToken(computedSourceOffWxml, 'computed-list')
        expect(computedListDisabledClass).toContain('computed-list')
        expect(computedListDisabledClass).not.toBe(computedListOnClass)

        const computedItemsOffClass = await tapControlAndReadClass(
          computedPage,
          '.issue289-computed-switch-items',
          '.issue289-computed-toggle-items',
        )
        expect(computedItemsOffClass).toContain('issue289-ctrl-off')
        expect(computedItemsOffClass).not.toContain('issue289-ctrl-on')

        const computedItemsOffWxml = await readPageWxml(computedPage)
        const computedEmptyClass = readFirstClassFromWxmlByToken(computedItemsOffWxml, 'computed-empty')
        expect(computedEmptyClass).toContain('computed-empty-b')
        expect(computedItemsOffWxml).not.toContain('computed-list-enabled')
        expect(computedItemsOffWxml).not.toContain('computed-list-disabled')

        const computedItemsOnClassAfter = await tapControlAndReadClass(
          computedPage,
          '.issue289-computed-switch-items',
          '.issue289-computed-toggle-items',
        )
        expect(computedItemsOnClassAfter).toContain('issue289-ctrl-on')
        expect(computedItemsOnClassAfter).not.toContain('issue289-ctrl-off')

        const computedItemsOnWxml = await readPageWxml(computedPage)
        const computedListDisabledClassAfter = readFirstClassFromWxmlByToken(computedItemsOnWxml, 'computed-list')
        expect(computedListDisabledClassAfter).toBe(computedListDisabledClass)

        const computedSourceOnClassAfter = await tapControlAndReadClass(
          computedPage,
          '.issue289-computed-switch-source',
          '.issue289-computed-toggle-source',
        )
        expect(computedSourceOnClassAfter).toContain('issue289-ctrl-on')
        expect(computedSourceOnClassAfter).not.toContain('issue289-ctrl-off')

        const computedSourceOnWxml = await readPageWxml(computedPage)
        const computedListEnabledClassAfter = readFirstClassFromWxmlByToken(computedSourceOnWxml, 'computed-list')
        expect(computedListEnabledClassAfter).toBe(computedListOnClass)
      },
    )
  })
})
