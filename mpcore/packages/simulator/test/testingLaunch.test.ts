import type { HeadlessTestingSessionHandle } from '../src/testing'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('testing launch diagnostics', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it('subscribes before app evaluation, lifecycle and first page rendering', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), `
console.info('app:evaluate')
App({ onLaunch() { console.info('app:launch') } })
`)
    fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.js'), `
Page({ data: { greeting: 'ready' }, onLoad() { console.info('page:load') } })
`)
    fs.writeFileSync(path.join(projectPath, 'dist/pages/index/index.wxml'), '<text id="result">{{greeting}}</text>')
    const entries: unknown[] = []
    const session = await launch({
      projectPath,
      async onSessionCreated(handle) {
        expect(await handle.currentPage()).toBeNull()
        handle.on('console', entry => entries.push(entry))
      },
    })
    expect(entries).toEqual([
      { level: 'info', args: ['app:evaluate'] },
      { level: 'info', args: ['app:launch'] },
      { level: 'info', args: ['page:load'] },
    ])
    const page = await session.currentPage()
    expect(await (await page?.$('#result'))?.text()).toBe('ready')
    await session.close()
  })

  it('closes the created session when the subscription hook fails', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    let handle: HeadlessTestingSessionHandle | undefined
    await expect(launch({
      projectPath,
      onSessionCreated(session) {
        handle = session
        throw new Error('subscription failed')
      },
    })).rejects.toThrow('subscription failed')
    await expect(handle?.currentPage()).rejects.toThrow(/closed/i)
  })
})
