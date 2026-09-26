import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { launch } from '../src/testing'
import { nativeSlotScopeFiles } from './helpers/nativeSlotScopes'

it('queries native slot content through its declaring scope as WeChat DevTools does', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-slot-query-'))
  for (const [file, source] of nativeSlotScopeFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = await launch({ projectPath })
  try {
    const page = (await session.currentPage())!
    for (const labels of [['first', 'second', 'third'], ['second', 'fourth']]) {
      await page.setData({ labels, owner: labels.join('|') })
      const hosts = await page.$$('#plain-host')
      expect(hosts).toHaveLength(1)
      expect(await hosts[0]!.$$('#plain')).toHaveLength(0)
      const probes = await page.$$('#plain')
      expect(probes).toHaveLength(1)
      const values = await probes[0]!.$$('.probe-value')
      expect(values).toHaveLength(1)
      expect(await values[0]!.text()).toBe(labels.join('|'))
      expect(await page.$$('.probe-value')).toHaveLength(0)
      const listHosts = await page.$$('#list-host')
      const generics = await listHosts[0]!.$$('component')
      expect(generics).toHaveLength(1)
      expect(await generics[0]!.$$('component')).toHaveLength(labels.length)
      const texts = await generics[0]!.$$('.row-label')
      expect(await Promise.all(texts.map(node => node.text()))).toEqual(labels)
      for (const label of labels) {
        const items = await generics[0]!.$$(`#item-${label}`)
        expect(items).toHaveLength(1)
        expect(await items[0]!.$$(`#${label}`)).toHaveLength(0)
      }
    }
  }
  finally {
    await session.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})
