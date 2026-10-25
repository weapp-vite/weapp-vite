import type { HeadlessSession } from '../src/runtime'
import { describe, expect, it } from 'vitest'
import { queryRetailPageRoot } from '../../../../e2e/utils/templateAcceptance/retailPageRoot'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingPageHandle } from '../src/testing/pageHandle'
import { createDocumentRootGoodsList, documentRootFiles } from '../test/helpers/documentRoots'

describe('complete page and tabbar document roots in the browser', () => {
  it('reads all sibling roots before and after a nested component update', async () => {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(documentRootFiles) })
    const preview = document.createElement('div')
    document.body.append(preview)
    try {
      const page = session.reLaunch('/pages/home/index')
      // 两种会话共享本用例所用公开接口；显式跨越私有字段造成的名义类型边界。
      const handle = new HeadlessTestingPageHandle(session.project, page, session as unknown as HeadlessSession)
      const readDocument = async () => {
        expect(await handle.getElementsByXpath('/*')).toHaveLength(2)
        return await (await queryRetailPageRoot(handle))!.wxml()
      }
      preview.innerHTML = await readDocument()
      expect(preview.querySelector('#header')?.textContent).toBe('first title')
      expect(preview.querySelector('#price')?.textContent).toBe('price:10')
      expect(preview.querySelector('#footer')?.textContent).toBe('footer')
      expect(preview.querySelector('#independent-tabbar')?.textContent).toBe('Home / Profile')
      expect(preview.querySelector('page #independent-tabbar')).toBeNull()

      const naturalGoodsList = await handle.data('goodsList')
      expect(naturalGoodsList).toEqual([
        { id: 'natural-first', title: 'naturally loaded first' },
        { id: 'natural-last', title: 'naturally loaded last' },
      ])
      expect(preview.querySelectorAll('.goods-card__title')).toHaveLength(2)
      expect(Array.from(preview.querySelectorAll('.goods-card__title'), card => card.textContent)).toEqual([
        'naturally loaded first',
        'naturally loaded last',
      ])

      const goodsList = createDocumentRootGoodsList()
      await handle.setData({ title: 'updated title', price: 20, goodsList })
      goodsList[0]!.title = 'caller mutation after protocol delivery'
      expect(await handle.data('goodsList')).toEqual(createDocumentRootGoodsList())
      const updatedCards = await handle.$$('.goods-card__title')
      expect(updatedCards).toHaveLength(4)
      expect(await Promise.all(updatedCards.map(card => card.text()))).toEqual([
        'prepared goods 1',
        'prepared goods 2',
        'prepared goods 3',
        'prepared goods 4',
      ])
      preview.innerHTML = await readDocument()
      expect(preview.querySelectorAll('.goods-card__title')).toHaveLength(4)
      expect(Array.from(preview.querySelectorAll('.goods-card__title'), card => card.textContent)).toEqual([
        'prepared goods 1',
        'prepared goods 2',
        'prepared goods 3',
        'prepared goods 4',
      ])
      expect(preview.querySelector('#header')?.textContent).toBe('updated title')
      expect(preview.querySelector('#price')?.textContent).toBe('price:20')
      expect(preview.querySelector('#footer')?.textContent).toBe('footer')
      expect(preview.querySelector('#independent-tabbar')?.textContent).toBe('Home / Profile')
    }
    finally {
      session.close()
      preview.remove()
    }
  })
})
