import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { queryRetailPageRoot } from '../../../../e2e/utils/templateAcceptance/retailPageRoot'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingPageHandle } from '../src/testing'
import { cleanupTempDirs } from './helpers'
import { createDocumentRootGoodsList, documentRootFiles } from './helpers/documentRoots'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

it('keeps every sibling view, nested component and independent tabbar through public headless page probes', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-document-roots-'))
  directories.push(projectPath)
  for (const [file, source] of documentRootFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/home/index')
    const handle = new HeadlessTestingPageHandle(session.project, page, session)
    expect(await handle.getElementsByXpath('/*')).toHaveLength(2)
    const initial = await (await queryRetailPageRoot(handle))!.wxml()
    expect(initial).toContain('<view id="header"')
    expect(initial).toContain('first title')
    expect(initial).toContain('<view id="goods"')
    expect(initial).toContain('price:10')
    expect(initial).toContain('<view id="footer"')
    expect(initial).toContain('independent-tabbar')
    expect(initial.indexOf('id="header"')).toBeLessThan(initial.indexOf('id="footer"'))
    expect(initial.indexOf('id="footer"')).toBeLessThan(initial.indexOf('id="independent-tabbar"'))

    const naturalGoodsList = await handle.data('goodsList')
    expect(naturalGoodsList).toEqual([
      { id: 'natural-first', title: 'naturally loaded first' },
      { id: 'natural-last', title: 'naturally loaded last' },
    ])
    const initialCards = await handle.$$('.goods-card__title')
    expect(initialCards).toHaveLength(2)
    expect(await Promise.all(initialCards.map(card => card.text()))).toEqual([
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
    expect(await handle.getElementsByXpath('/*')).toHaveLength(2)
    const updated = await (await queryRetailPageRoot(handle))!.wxml()
    expect(updated).toContain('updated title')
    expect(updated).toContain('price:20')
    expect(updated).toContain('id="footer"')
    expect(updated).toContain('id="independent-tabbar"')
    expect(updated).not.toContain('first title')
  }
  finally {
    session.close()
  }
})
