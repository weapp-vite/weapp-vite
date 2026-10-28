import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing/launch'
import { createLaunchCallbackErrorFixture, launchCallbackErrorCases } from './helpers/launchCallbackErrors'

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
    expect(session.getApp()?.globalData).toMatchObject({ loads: ['home', 'login'], launchCalls: 1 })
    expect(session.renderCurrentPage().wxml).toContain('id="launch-login"')
    session.reLaunch('/pages/home/index')
    expect(session.getCurrentPages().map(item => item.route)).toEqual(['pages/home/index'])
    expect(session.getApp()?.globalData).toMatchObject({ loads: ['home', 'login', 'home'], launchCalls: 1 })
    session.close()
  })

  it('completes launch reLaunch after the App stack and before the first page ready', async () => {
    const session = createSession()
    try {
      expect(session.reLaunch('/pages/home/index').route).toBe('pages/login/index')
      const data = session.getApp()!.globalData
      const committed = [
        'app:launch:start',
        'app:launch:end',
        'app:show',
        'home:load',
        'home:show',
        'home:unload',
        'login:load',
        'login:show',
        'redirect:success',
        'redirect:complete',
      ]
      expect(data.events).toEqual(committed)
      await expect.poll(() => data.events).toEqual([...committed, 'login:ready'])
      expect(data).toMatchObject({ loads: ['home', 'login'], launchCalls: 1 })
      expect(session.getCurrentPages().map(page => page.route)).toEqual(['pages/login/index'])
      expect(session.renderCurrentPage().wxml).toContain('id="launch-login"')
      session.reLaunch('/pages/home/index')
      await expect.poll(() => data.events.at(-1)).toBe('home:ready')
      expect(data).toMatchObject({ loads: ['home', 'login', 'home'], launchCalls: 1 })
    }
    finally {
      session.close()
    }
  })

  it.each(launchCallbackErrorCases)('isolates $callback errors from launch $method callbacks', async ({ method, callback }) => {
    const fixture = createLaunchCallbackErrorFixture(method, callback)
    let session: ReturnType<typeof createHeadlessSession> | ReturnType<typeof createBrowserHeadlessSession>
    if (provider === 'headless') {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-callback-errors-'))
      tempDirs.push(projectPath)
      for (const [file, source] of fixture.files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      session = createHeadlessSession({ projectPath })
    }
    else {
      session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(fixture.files) })
    }
    try {
      expect(session.reLaunch('/pages/home/index').route).toBe(`pages/${fixture.targetPage}/index`)
      const data = session.getApp()!.globalData
      expect(data.callbacks).toEqual(fixture.expectedCallbacks)
      expect(data.events).toEqual(fixture.committedEvents)
      expect(data.launchCalls).toBe(1)
      expect(data.loads).toEqual(callback === 'fail' ? ['home'] : ['home', 'login'])
      expect(session.getCurrentPages().map(page => page.route)).toEqual([`pages/${fixture.targetPage}/index`])
      if (callback !== 'fail') {
        expect(data.navigationError).toBeUndefined()
      }
      await expect.poll(() => data.events).toEqual([...fixture.committedEvents, fixture.readyEvent])
      await expect.poll(() => session.getDiagnostics()).toHaveLength(1)
      expect(session.getDiagnostics()[0]).toMatchObject({ level: 'exception', args: [data.callbackError] })
      expect(session.getDiagnostics()[0]!.args[0]).toBe(data.callbackError)
      expect(data.callbackError.message).toBe(fixture.errorMessage)
      expect(data.callbacks).toEqual(fixture.expectedCallbacks)
    }
    finally {
      session.close()
    }
  })

  it('preserves the final onShow navigation after onLaunch has redirected', () => {
    const session = createSession(`App({
      globalData: { loads: [] },
      onLaunch() { wx.reLaunch({ url: '/pages/login/index?from=launch' }) },
      onShow() { wx.reLaunch({ url: '/pages/login/index?from=show' }) },
    })`)
    const page = session.reLaunch('/pages/home/index')
    expect(page.data.from).toBe('show')
    expect(session.getApp()?.globalData.loads).toEqual(['home', 'login', 'login'])
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

  it('keeps the initial target when launch navigation fails before commit', async () => {
    const session = createSession(`App({
      globalData: { loads: [], failed: false },
      onLaunch() {
        wx.reLaunch({ url: '/pages/missing/index', fail: () => { this.globalData.failed = true } })
      },
    })`)
    expect(session.reLaunch('/pages/home/index').route).toBe('pages/home/index')
    await expect.poll(() => session.getApp()?.globalData).toMatchObject({ failed: true, loads: ['home'] })
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
