import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

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

    await expect(page.waitForSelector('#missing-node', {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for selector "#missing-node" to appear')
    await expect(page.waitForText('definitely-missing-text', {
      timeout: 30,
    })).rejects.toThrow('Timed out waiting for text "definitely-missing-text"')
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
})
