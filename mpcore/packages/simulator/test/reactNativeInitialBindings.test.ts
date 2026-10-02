import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { reactNativeInitialBindingFiles } from './helpers/reactNativeInitialBindings'

it.each(['node', 'browser'] as const)('%s mounts a native bridge with committed falsey props and keeps its identity', (provider) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-bindings-'))
  for (const [file, source] of reactNativeInitialBindingFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  let session: ReturnType<typeof createHeadlessSession> | ReturnType<typeof createBrowserHeadlessSession> | undefined
  try {
    session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(reactNativeInitialBindingFiles) })
    const page = session.reLaunch('/pages/index/index')
    expect(page.selectComponent!('#value')).toBeNull()
    expect(session.getApp()?.globalData.attached).toEqual([])
    page.setData({ slots: { s0: { value: 0, enabled: false, label: '' } } })
    const component = page.selectComponent!('#value')
    expect(component.properties).toMatchObject({ value: 0, enabled: false, label: '' })
    expect(session.getApp()?.globalData.attached).toEqual([{ value: 0, enabled: false, label: '' }])
    component.setData({ local: 7 })
    page.setData({ 'slots.s0.value': 2 })
    expect(page.selectComponent!('#value')).toBe(component)
    expect(component.data).toMatchObject({ value: 2, local: 7 })
    expect(session.getApp()?.globalData.attached).toHaveLength(1)
  }
  finally {
    session?.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})
