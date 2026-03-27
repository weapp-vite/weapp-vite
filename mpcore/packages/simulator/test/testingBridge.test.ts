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
