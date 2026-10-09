import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs } from './helpers'
import { unprojectedSlotFiles } from './helpers/unprojectedSlots'

describe('unprojected declarations through public testing probes', () => {
  const tempDirs: string[] = []
  const sessions: Array<{ close: () => Promise<void> }> = []

  afterEach(async () => {
    for (const session of sessions.splice(0)) {
      await session.close()
    }
    cleanupTempDirs(tempDirs)
  })

  it('keeps hidden declarations inspectable without reporting positive rendered bounds', async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-unprojected-inspection-'))
    tempDirs.push(projectPath)
    for (const [file, source] of unprojectedSlotFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const app = await launch({ projectPath })
    sessions.push(app)
    const page = await app.currentPage()
    expect(page).not.toBeNull()
    const selectors = ['#leaf-one', '#leaf-header']
    for (const open of [false, true, false]) {
      await page!.setData({ open })
      const grouped = await page!.renderedSelectorNodes(selectors)
      for (const selector of selectors) {
        const inspected = await page!.$$(selector)
        expect(inspected).toHaveLength(1)
        const rendered = await page!.renderedNodes(selector)
        expect(grouped[selector]).toEqual(rendered)
        if (open) {
          expect(rendered).toMatchObject([{ id: selector.slice(1) }])
          expect(rendered[0]!.width).toBeGreaterThan(0)
          expect(rendered[0]!.height).toBeGreaterThan(0)
        }
        else {
          expect(rendered).toEqual([])
        }
      }
    }
  })
})
