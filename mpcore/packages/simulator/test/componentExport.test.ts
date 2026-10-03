import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { componentExportFiles, componentExportSnapshot, createOwnerComponentExportFiles } from './helpers/componentExport'

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

it.each(['direct', 'nested'] as const)('respects %s owner exports without filtering the raw testing bridge', (behavior) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-owner-export-'))
  for (const [file, source] of createOwnerComponentExportFiles(behavior)) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    session.reLaunch('/pages/index/index')
    const rawOwner = session.selectComponent('#exported')!
    const probe = session.selectComponent('#exported-probe')!
    const owner = probe.inspectOwner()
    expect(Object.keys(owner).sort()).toEqual(['increment', 'label'])
    expect(owner.label).toBe('filtered-owner')
    expect(probe.data.privateVisible).toBe('false')
    probe.incrementOwner()
    expect(rawOwner.data.count).toBe(1)
    expect(session.renderCurrentPage().wxml).toContain('>1</text>')

    const rawBridgeOwner = session.selectOwnerComponent(session.getScopeIdForComponent(probe)!)!
    expect(rawBridgeOwner).toBe(rawOwner)
    expect(rawBridgeOwner.data.secret).toBe('private owner state')
    rawBridgeOwner.privateIncrement()
    expect(rawOwner.data.count).toBe(2)

    const ordinaryOwner = session.selectComponent('#plain')!
    const ordinaryProbe = session.selectComponent('#plain-probe')!
    expect(ordinaryProbe.getOwner()).toBe(ordinaryOwner)
    expect(ordinaryProbe.getOwner().data.label).toBe('ordinary-owner')
    expect(rawOwner.selectOwnerComponent?.()).toBeNull()
  }
  finally {
    session.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})
