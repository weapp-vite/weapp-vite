import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture, createComponentFixture, createNavigationFixture } from './helpers'

describe('headless testing bridge', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('launches a session and exposes current page handles', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    expect(await page.data('__e2eResult.status')).toBe('ready')

    const currentPage = await miniProgram.currentPage()
    expect(currentPage).not.toBeNull()
    expect(await currentPage?.data('__e2eData.greeting')).toBe('Hello')
  })

  it('calls page methods through the testing bridge', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.callMethod('onTap')

    expect(await page.data('__e2eResult')).toEqual({
      status: 'tapped',
      detail: 'tap handled',
    })
  })

  it('triggers tap bindings from rendered nodes and maps dataset keys', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    const button = await page.$('#greeting-button')

    expect(button).not.toBeNull()
    expect(await button?.dataset()).toEqual({
      cardType: 'primary',
      phase: 'initial',
    })

    await button?.tap()

    expect(await page.data('__e2eResult')).toEqual({
      status: 'tapped',
      detail: 'tap handled',
    })
    expect(await page.data('__e2eTap')).toEqual({
      currentTarget: {
        dataset: {
          cardType: 'primary',
          phase: 'initial',
        },
        id: 'greeting-button',
      },
      target: {
        dataset: {
          cardType: 'primary',
          phase: 'initial',
        },
        id: 'greeting-button',
      },
    })
  })

  it('triggers arbitrary bound events from rendered nodes', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    const input = await page.$('#greeting-input')

    expect(input).not.toBeNull()
    expect(await input?.dataset()).toEqual({
      field: 'greeting',
    })

    await input?.trigger('input', {
      detail: {
        value: 'Updated by trigger',
      },
    })

    expect(await page.data('__e2eInput')).toEqual({
      detail: {
        value: 'Updated by trigger',
      },
      type: 'input',
    })
  })

  it('provides convenience helpers for input, change and blur events', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    const input = await page.$('#greeting-input')

    expect(input).not.toBeNull()

    await input?.input('Typed from helper')
    await input?.change('Committed from helper')
    await input?.blur('Blurred from helper')

    expect(await page.data('__e2eInput')).toEqual({
      detail: {
        value: 'Typed from helper',
      },
      type: 'input',
    })
    expect(await page.data('__e2eChange')).toEqual({
      detail: {
        value: 'Committed from helper',
      },
      type: 'change',
    })
    expect(await page.data('__e2eBlur')).toEqual({
      detail: {
        value: 'Blurred from helper',
      },
      type: 'blur',
    })
  })

  it('waits for selectors and async text updates through the testing bridge', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')

    const button = await page.waitForSelector('#greeting-button')
    expect(await button?.text()).toBe('Hello')

    await page.callMethod('showAsyncText')
    expect(await page.waitForText('async ready', {
      timeout: 200,
    })).toBe('async ready')

    const asyncNode = await page.waitForSelector('#async-text')
    expect(await asyncNode?.text()).toBe('async ready')

    await page.callMethod('clearAsyncText')
    await page.waitForTextGone('async ready', {
      timeout: 200,
    })
    expect(await page.waitForSelector('#missing-node', {
      state: 'detached',
      timeout: 30,
    })).toBeNull()

    await expect(page.waitForSelector('#missing-node', {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for selector "#missing-node" to appear')
    await expect(page.waitForText('definitely-missing-text', {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for text "definitely-missing-text"')
    await expect(page.waitForTextGone('async ready', {
      timeout: 10,
    })).resolves.toBeUndefined()
  })

  it('waits for async page data updates through the testing bridge', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')

    expect(await page.waitForData('__e2eAsyncCount', 0, {
      timeout: 30,
    })).toBe(0)

    await page.callMethod('bumpAsyncCount')

    expect(await page.waitForData('__e2eAsyncCount', 2, {
      timeout: 200,
    })).toBe(2)
    expect(await page.waitForData('__e2eAsyncCount', (value: unknown) => Number(value) >= 2, {
      timeout: 30,
    })).toBe(2)

    const countNode = await page.waitForSelector('#async-count')
    expect(await countNode?.text()).toBe('2')

    await expect(page.waitForData('__e2eAsyncCount', 99, {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for data "__e2eAsyncCount"')
  })

  it('runs wx.nextTick callbacks after setData in headless runtime', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.callMethod('runNextTickUpdate')

    expect(await page.waitForData('__e2eResult.detail', 'next-tick-ready', {
      timeout: 200,
    })).toBe('next-tick-ready')
    expect(await page.data('__e2eResult')).toEqual({
      status: 'next-tick-ready',
      detail: 'next-tick-ready',
    })
  })

  it('waits for async current-page navigation through the session handle', async () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const homePage = await miniProgram.reLaunch('/pages/home/index')
    await homePage.callMethod('goDetailLater')

    const detailPage = await miniProgram.waitForCurrentPage('/pages/detail/index', {
      timeout: 200,
    })

    expect(detailPage).not.toBeNull()
    expect(await detailPage?.data('logs')).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home-later"}',
      'detail:onShow',
      'detail:onReady',
    ])

    await expect(miniProgram.waitForCurrentPage('/pages/missing/index', {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for current page "pages/missing/index"')
  })

  it('renders interpolated wxml and supports basic selectors', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    const root = await page.$('page')
    expect(root).not.toBeNull()

    const panelRows = await page.$$('.panel-row')
    expect(panelRows).toHaveLength(4)
    expect(await panelRows[0]?.text()).toBe('Status: ready')
    expect(await panelRows[3]?.text()).toBe('Target: index snapshot')

    const wxml = await root?.wxml()
    expect(wxml).toContain('<view id="greeting-button" data-phase="initial" data-card-type="primary" bind:tap="onTap">Hello</view>')
    expect(wxml).toContain('Status: ready')
    expect(wxml).toContain('Greeting: Hello')
  })

  it('renders custom component output through the testing bridge', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/lab/index')

    expect(await page.wxml()).toContain('count: 2')
    await page.callMethod('inspect')
    expect(await page.data('snapshot')).toContain('"size":1')
  })

  it('dispatches component node events to the component instance through the testing bridge', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/lab/index')
    const trigger = await page.$('#card-trigger')

    expect(trigger).not.toBeNull()
    await trigger?.tap()

    expect(await page.data('log')).toEqual(['status-card'])
  })

  it('preserves component event target, currentTarget and mark through the testing bridge', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/lab/index')
    const trigger = await page.$('#card-trigger')

    await trigger?.tap({
      mark: {
        source: 'testing-bridge',
      },
    })

    expect(await page.data('eventSnapshot')).toContain('"targetId":"card-trigger"')
    expect(await page.data('eventSnapshot')).toContain('"currentTargetId":"status-card"')
    expect(await page.data('eventSnapshot')).toContain('"source":"testing-bridge"')
  })

  it('exposes scope snapshots through the testing bridge session handle', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/lab/index')
    const wxml = await page.wxml()
    const scopeIds = Array.from(wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const componentScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))

    expect(componentScopeId).toBeTruthy()
    expect(await miniProgram.scopeSnapshot(componentScopeId!)).toMatchObject({
      properties: {
        count: 2,
      },
      type: 'component',
    })
  })

  it('selects component scope handles directly from the testing bridge session handle', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    await miniProgram.reLaunch('/pages/lab/index')
    const component = await miniProgram.selectComponent('#status-card')
    const components = await miniProgram.selectAllComponents('status-card')

    expect(component).not.toBeNull()
    expect(component?.scopeId).toContain('status-card')
    expect(components).toHaveLength(1)
    expect(await component?.snapshot()).toMatchObject({
      properties: {
        count: 2,
      },
      type: 'component',
    })
  })

  it('dispatches component input, change and blur events through the testing bridge', async () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({
      projectPath,
    })

    const page = await miniProgram.reLaunch('/pages/lab/index')
    const input = await page.$('#card-input')

    expect(input).not.toBeNull()

    await input?.input('typed-in-component')
    await input?.change('changed-in-component')
    await input?.blur('blurred-in-component')
    await page.callMethod('inspectForm')

    expect(await page.data('formSnapshot')).toContain('"input":"typed-in-component"')
    expect(await page.data('formSnapshot')).toContain('"change":"changed-in-component"')
    expect(await page.data('formSnapshot')).toContain('"blur":"blurred-in-component"')
  })
})
