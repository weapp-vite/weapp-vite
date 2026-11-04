import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inspectClassicPublication } from '../classicPublication'

describe('complete weapp directory component publication inspection', () => {
  let root: string
  const write = async (name: string, source: string) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await writeFile(path.join(root, name), source)
  }
  const writeEntry = async (entry: string) => {
    await write(`${entry}.js`, 'Component({});')
    await write(`${entry}.json`, '{}')
    await write(`${entry}.wxml`, '<view/>')
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hmr-weapp-directory-publication-'))
    await write('app.js', 'App({});')
    await write('app.json', JSON.stringify({ pages: ['pages/index'] }))
    await writeEntry('pages/index')
    await write('pages/index.json', JSON.stringify({ usingComponents: { bubble: 'antd-mini/Bubble/index' } }))
    await writeEntry('miniprogram_npm/antd-mini/Bubble/index')
    await write('miniprogram_npm/antd-mini/Bubble/index.json', JSON.stringify({ usingComponents: { loading: '../Loading' } }))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('checks the directory entry and every required companion file', async () => {
    const stem = 'miniprogram_npm/antd-mini/Loading/index'
    await writeEntry(stem)
    const evidence = await inspectClassicPublication(root, 'weapp')
    expect(evidence.checkedFileCount).toBe(evidence.files.length)
    expect(evidence.files.map(file => file.path)).toEqual(expect.arrayContaining([
      `${stem}.js`,
      `${stem}.json`,
      `${stem}.wxml`,
    ]))
    for (const extension of ['.js', '.json', '.wxml']) {
      await rm(path.join(root, `${stem}${extension}`))
      await expect(inspectClassicPublication(root, 'weapp')).rejects.toThrow('Classic publication is missing')
      await writeEntry(stem)
    }
  })

  it.each(['.json', '.wxml'])('keeps a present explicit script stem authoritative when %s is missing', async (extension) => {
    const stem = 'miniprogram_npm/antd-mini/Loading'
    await writeEntry(stem)
    await writeEntry(`${stem}/index`)
    await rm(path.join(root, `${stem}${extension}`))
    await expect(inspectClassicPublication(root, 'weapp')).rejects.toThrow(`Classic publication is missing ${stem}${extension}`)
  })
})
