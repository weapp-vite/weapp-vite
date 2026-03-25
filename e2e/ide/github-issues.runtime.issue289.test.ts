import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  readClassName,
  readFirstClassFromWxmlByToken,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  tapControlAndReadClass,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / issue-289', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #289: updates runtime classes on split pages', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)

    try {
      const objectPage = await relaunchPage(miniProgram, '/pages/issue-289/object-literal/index', 'object-list-loose')
      if (!objectPage) {
        throw new Error('Failed to launch object-literal page')
      }

      const objectInitialWxml = await readPageWxml(objectPage)
      expect(objectInitialWxml).toContain('object-list-loose')
      expect(objectInitialWxml).not.toContain('object list hidden')

      const objectResult = await objectPage.callMethod('runE2E')
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

      const mapPage = await relaunchPage(miniProgram, '/pages/issue-289/map-class/index', 'issue289-map-toggle-expanded')
      if (!mapPage) {
        throw new Error('Failed to launch map-class page')
      }

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

      const rootPage = await relaunchPage(miniProgram, '/pages/issue-289/root-class/index', 'root class: aaaa')
      if (!rootPage) {
        throw new Error('Failed to launch root-class page')
      }

      const rootInitialWxml = await readPageWxml(rootPage)
      expect(rootInitialWxml).toContain('root class: aaaa')

      const rootResult = await rootPage.callMethod('runE2E')
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

      const computedPage = await relaunchPage(miniProgram, '/pages/issue-289/computed-class/index', 'issue289-computed-toggle-source')
      if (!computedPage) {
        throw new Error('Failed to launch computed-class page')
      }

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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
