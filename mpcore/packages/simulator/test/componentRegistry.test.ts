import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { registryComponentFiles, registryConfig, registryFiles, registryPageConfig, registryRoute } from './helpers/componentRegistry'

function createFixture(target?: string) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-registry-'))
  const write = (file: string, source: string) => {
    const absolute = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, source)
  }
  for (const [file, source] of registryFiles(target)) {
    write(file, source)
  }
  const session = createHeadlessSession({ projectPath })
  return {
    projectPath,
    session,
    write,
    close() {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    },
  }
}

it('reads each owner config and resolves its aliases once across attachment reconciliation in a render', () => {
  const fixture = createFixture()
  const { session } = fixture
  try {
    const page = session.reLaunch(registryRoute)
    page.setData({ show: true })
    const read = vi.spyOn(session.project.artifactSource, 'readText')
    const has = vi.spyOn(session.project.artifactSource, 'has')
    const rendered = session.renderCurrentPage().wxml
    const reads = (file: string) => read.mock.calls.filter(([candidate]) => path.normalize(candidate) === path.join(fixture.projectPath, file)).length
    expect(rendered).toContain('A:left:true')
    expect(rendered).toContain('A:right:true')
    expect(rendered).toContain('left slot')
    expect(rendered).toContain('right slot')
    expect(reads(registryPageConfig)).toBe(1)
    expect(reads('miniprogram_npm/registry-a/index.json')).toBe(1)
    expect(reads('pages/index/registry-a.js')).toBe(0)
    expect(has.mock.calls.filter(([candidate]) => path.normalize(candidate) === path.join(fixture.projectPath, 'pages/index/registry-a.js'))).toHaveLength(1)
    read.mockRestore()
    has.mockRestore()
    const left = session.selectComponent('#left')!
    const right = session.selectComponent('#right')!
    expect(left).not.toBe(right)
    left.setData({ ready: false })
    expect(right.data.ready).toBe(true)
    expect(session.renderCurrentPage().wxml).toContain('A:left:false')
  }
  finally {
    vi.restoreAllMocks()
    fixture.close()
  }
})

it('refreshes config and equal-length native template edits on subsequent renders without sharing instances', () => {
  const fixture = createFixture()
  const other = createFixture('registry-b')
  try {
    const page = fixture.session.reLaunch(registryRoute)
    page.setData({ show: true })
    other.session.reLaunch(registryRoute).setData({ show: true, left: 'other' })
    for (const marker of ['A', 'B', 'A']) {
      fixture.write(registryPageConfig, registryConfig(`registry-${marker.toLowerCase()}`))
      const rendered = fixture.session.renderCurrentPage().wxml
      expect(rendered).toContain(`${marker}:left:true`)
      expect(rendered).toContain(`${marker}:right:true`)
      expect(rendered).toContain('left slot')
      expect(rendered).toContain('right slot')
      expect(other.session.renderCurrentPage().wxml).toContain('B:other:true')
      expect(fixture.session.getCurrentPages()[0]).toBe(page)
    }
    for (const marker of ['C', 'A']) {
      fixture.write('miniprogram_npm/registry-a/index.wxml', registryComponentFiles('registry-a', marker)[2]![1])
      expect(fixture.session.renderCurrentPage().wxml).toContain(`${marker}:left:true`)
    }
  }
  finally {
    fixture.close()
    other.close()
  }
})

it('resolves a previously missing npm component when it appears in the next render', () => {
  const fixture = createFixture('registry-added')
  try {
    const page = fixture.session.reLaunch(registryRoute)
    expect(fixture.session.renderCurrentPage().wxml).not.toContain('ADDED:')
    for (const [file, source] of registryComponentFiles('registry-added', 'ADDED')) {
      fixture.write(file, source)
    }
    page.setData({ show: true })
    expect(fixture.session.renderCurrentPage().wxml).toContain('ADDED:left:true')
  }
  finally {
    fixture.close()
  }
})

it.each(['missing', 'malformed', 'read failure'] as const)('recovers a %s config on the next render', (failure) => {
  const fixture = createFixture()
  try {
    const page = fixture.session.reLaunch(registryRoute)
    page.setData({ show: true })
    if (failure === 'missing') {
      fs.rmSync(path.join(fixture.projectPath, registryPageConfig))
    }
    else if (failure === 'malformed') {
      fixture.write(registryPageConfig, '{')
    }
    else {
      const source = fixture.session.project.artifactSource
      const original = source.readText.bind(source)
      vi.spyOn(source, 'readText').mockImplementation((file) => {
        if (path.normalize(file) === path.join(fixture.projectPath, registryPageConfig)) {
          throw new Error('fixture config read failed')
        }
        return original(file)
      })
    }
    expect(fixture.session.renderCurrentPage().wxml).not.toContain('A:left:')
    vi.restoreAllMocks()
    fixture.write(registryPageConfig, registryConfig())
    expect(fixture.session.renderCurrentPage().wxml).toContain('A:left:true')
  }
  finally {
    vi.restoreAllMocks()
    fixture.close()
  }
})

it('discards the render snapshot after a template read throws', () => {
  const fixture = createFixture()
  try {
    const page = fixture.session.reLaunch(registryRoute)
    page.setData({ show: true })
    fs.rmSync(path.join(fixture.projectPath, 'miniprogram_npm/registry-a/index.wxml'))
    expect(() => fixture.session.renderCurrentPage()).toThrow(/Missing template/)
    fixture.write(registryPageConfig, registryConfig('registry-b'))
    expect(fixture.session.renderCurrentPage().wxml).toContain('B:left:true')
  }
  finally {
    fixture.close()
  }
})
