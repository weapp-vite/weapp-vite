import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing/launch'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../demos/web/src/fixtures/launch-redirect')
const fixtureFiles = fs.readdirSync(fixtureRoot, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map((entry): [string, string] => {
    const file = path.join(entry.parentPath, entry.name)
    return [path.relative(fixtureRoot, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')]
  })
const tempDirs: string[] = []

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function createFixture(appSource?: string) {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-navigation-'))
  tempDirs.push(projectPath)
  fs.cpSync(fixtureRoot, projectPath, { recursive: true })
  if (appSource) {
    fs.writeFileSync(path.join(projectPath, 'app.js'), appSource)
  }
  return projectPath
}

describe.each(['headless', 'browser'] as const)('%s launch navigation ownership', (provider) => {
  function createSession(appSource?: string) {
    if (provider === 'headless') {
      return createHeadlessSession({ projectPath: createFixture(appSource) })
    }
    const files = fixtureFiles.map(([name, source]): [string, string] => [name, name === 'app.js' && appSource ? appSource : source])
    return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  }

  it.each(['reLaunch', 'navigateTo', 'redirectTo', 'switchTab'] as const)('preserves onLaunch navigation during initial %s', (entry) => {
    const session = createSession()
    const page = session[entry]('/pages/home/index')
    expect(page?.route).toBe('pages/login/index')
    expect(page?.data.from).toBe('launch')
    expect(session.getCurrentPages().map(item => item.route)).toEqual(['pages/login/index'])
    expect(session.getApp()?.globalData).toMatchObject({ loads: ['login'], launchCalls: 1 })
    expect(session.renderCurrentPage().wxml).toContain('id="launch-login"')
    session.reLaunch('/pages/home/index')
    expect(session.getCurrentPages().map(item => item.route)).toEqual(['pages/home/index'])
    expect(session.getApp()?.globalData).toMatchObject({ loads: ['login', 'home'], launchCalls: 1 })
    session.close()
  })

  it('preserves the final onShow navigation after onLaunch has redirected', () => {
    const session = createSession(`App({
      globalData: { loads: [] },
      onLaunch() { wx.reLaunch({ url: '/pages/login/index?from=launch' }) },
      onShow() { wx.reLaunch({ url: '/pages/login/index?from=show' }) },
    })`)
    const page = session.reLaunch('/pages/home/index')
    expect(page.data.from).toBe('show')
    expect(session.getApp()?.globalData.loads).toEqual(['login', 'login'])
    expect(session.getCurrentPages()).toEqual([page])
    session.close()
  })

  it('does not pop a stack created during bootstrap of navigateBack', () => {
    const session = createSession(`App({
      globalData: { loads: [] },
      onLaunch() {
        wx.reLaunch({ url: '/pages/home/index' })
        wx.navigateTo({ url: '/pages/login/index?from=launch' })
      },
    })`)
    expect(session.navigateBack()?.route).toBe('pages/login/index')
    expect(session.getCurrentPages().map(item => item.route)).toEqual(['pages/home/index', 'pages/login/index'])
    session.close()
  })

  it('keeps the initial target when launch navigation fails before commit', () => {
    const session = createSession(`App({
      globalData: { loads: [], failed: false },
      onLaunch() {
        wx.reLaunch({ url: '/pages/missing/index', fail: () => { this.globalData.failed = true } })
      },
    })`)
    expect(session.reLaunch('/pages/home/index').route).toBe('pages/home/index')
    expect(session.getApp()?.globalData).toMatchObject({ failed: true, loads: ['home'] })
    session.close()
  })
})

it('testing launch does not re-enter the initial route after app redirection', async () => {
  const miniProgram = await launch({ projectPath: createFixture() })
  try {
    expect((await miniProgram.currentPage())?.path).toBe('pages/login/index')
  }
  finally {
    await miniProgram.close()
  }
})
