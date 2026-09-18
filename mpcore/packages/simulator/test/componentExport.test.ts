import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { componentExportFiles, componentExportSnapshot } from './helpers/componentExport'

it('uses custom exports for native selection while preserving testing access to instances', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-export-'))
  for (const [file, source] of componentExportFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.inspect()).toEqual(componentExportSnapshot)
    const raw = session.selectComponent('#exported')!
    raw.setData({ label: 'updated' })
    expect(page.inspect().exported).toEqual({ label: 'updated' })
    expect(session.renderCurrentPage().wxml).toContain('>updated</text>')
  }
  finally {
    session.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})
