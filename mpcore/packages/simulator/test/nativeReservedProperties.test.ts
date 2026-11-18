import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'

const files: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { probe: '../../components/probe/index' } })],
  ['pages/index/index.js', 'Page({ inspect() { return this.selectComponent("probe").snapshot() } })'],
  ['pages/index/index.wxml', '<probe id="host-id" class="host-class" slot="host-slot" wx:if="{{true}}" style="color: rgb(22, 119, 255);" />'],
  ['components/probe/index.json', '{}'],
  ['components/probe/index.js', `Component({
    properties: { id: String, class: String, slot: String, 'wx:if': Boolean, style: String },
    methods: { snapshot() { return {
      id: this.properties.id ?? '',
      class: this.properties.class ?? '',
      slot: this.properties.slot ?? '',
      wxIf: this.properties['wx:if'] ?? false,
      style: this.properties.style ?? '',
    } } },
  })`],
  ['components/probe/index.wxml', '<view>{{id}}|{{class}}|{{slot}}|{{style}}</view>'],
]

describe.each(['node', 'browser'] as const)('%s reserved component host properties', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('keeps id, class, and slot empty while passing style', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-reserved-properties-'))
    directories.push(projectPath)
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }

    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/index/index')
      session.renderCurrentPage()
      expect(page.inspect()).toEqual({
        id: '',
        class: '',
        slot: '',
        wxIf: false,
        style: 'color: rgb(22, 119, 255);',
      })
    }
    finally {
      session.close()
    }
  })
})
