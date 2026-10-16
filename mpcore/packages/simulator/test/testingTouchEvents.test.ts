import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs } from './helpers'
import { touchEventFiles, touchPoint } from './helpers/touchEvents'

describe('headless automator touch events', () => {
  const directories: string[] = []

  afterEach(() => cleanupTempDirs(directories))

  it('delivers touches and changedTouches to page and component handlers through the rendered node', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-touch-'))
    directories.push(projectPath)
    for (const [name, contents] of touchEventFiles) {
      const target = path.join(projectPath, name)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, contents)
    }
    const handle = await launch({ projectPath })
    try {
      const page = (await handle.currentPage())!
      const node = (await page.$('#touch'))!
      await node.touchstart({ touches: [touchPoint], changedTouches: [touchPoint] })
      await node.touchmove({ touches: [touchPoint], changeTouches: [touchPoint] })
      await node.touchend({ touches: [], changedTouches: [touchPoint], changeTouches: [] })
      const events = await page.data('events') as Array<Record<string, unknown>>
      expect(events.map(event => event.type)).toEqual(['touchstart', 'touchmove', 'touchend'])
      expect(events.map(event => event.touches)).toEqual([[touchPoint], [touchPoint], []])
      expect(events.map(event => event.changedTouches)).toEqual([[touchPoint], [touchPoint], [touchPoint]])
      expect(events[0]).toMatchObject({ target: { id: 'touch', dataset: { kind: 'page' } }, currentTarget: { id: 'touch' } })
      expect(events[0]).not.toHaveProperty('changeTouches')
      await (await page.$('touch-card'))!.dispatchEvent({ eventName: 'touchend', $: '#component-touch', touches: [], changedTouches: [touchPoint], detail: { source: 'dispatch' } })
      const card = await page.selectComponent('#card')
      expect((await card!.snapshot())?.data.events).toMatchObject([{ type: 'touchend', touches: [], changedTouches: [touchPoint], detail: { source: 'dispatch' }, target: { id: 'component-touch' } }])
      expect(await (await (await page.$('touch-card'))!.$('#component-touch'))!.text()).toBe('touchend')
    }
    finally {
      await handle.disconnect()
    }
  })
})
