import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { pureDataExpectedSnapshot, pureDataFiles } from './helpers/pureData'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

it.each(['node', 'browser'] as const)('keeps native pure data and property observers outside the view in %s', (provider) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-pure-data-'))
  directories.push(projectPath)
  for (const [file, source] of pureDataFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = provider === 'node'
    ? createHeadlessSession({ projectPath })
    : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(pureDataFiles) })
  try {
    session.reLaunch('/pages/index/index')
    expect(session.renderCurrentPage().wxml).toContain('updated||')
    const component = session.selectComponent('#probe')!
    expect(component.snapshot).toEqual(pureDataExpectedSnapshot)
    component.setData({ visible: 'next', _private: 'next-secret' })
    expect(session.renderCurrentPage().wxml).toContain('next||')
    expect(component.data._private).toBe('next-secret')
    expect(component.data.dataEvents).toEqual(['updated-secret', 'next-secret'])
  }
  finally {
    session.close()
  }
})
