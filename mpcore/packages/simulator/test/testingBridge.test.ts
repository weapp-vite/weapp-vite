import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { launch } from '../src/testing'

describe('headless testing bridge', () => {
  it('launches a session and exposes current page handles', async () => {
    const miniProgram = await launch({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    expect(await page.data('__e2eResult.status')).toBe('ready')

    const currentPage = await miniProgram.currentPage()
    expect(currentPage).not.toBeNull()
    expect(await currentPage?.data('__e2eData.greeting')).toBe('Hello')
  })

  it('calls page methods through the testing bridge', async () => {
    const miniProgram = await launch({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.callMethod('onTap')

    expect(await page.data('__e2eResult')).toEqual({
      status: 'tapped',
      detail: 'tap handled',
    })
  })

  it('renders interpolated wxml and supports basic selectors', async () => {
    const miniProgram = await launch({
      projectPath: path.resolve(import.meta.dirname, '../../../../e2e-apps/base'),
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    const root = await page.$('page')
    expect(root).not.toBeNull()

    const panelRows = await page.$$('.panel-row')
    expect(panelRows).toHaveLength(4)
    expect(await panelRows[0]?.text()).toBe('Status: ready')
    expect(await panelRows[3]?.text()).toBe('Target: index snapshot')

    const wxml = await root?.wxml()
    expect(wxml).toContain('<view bind:tap="onTap">Hello</view>')
    expect(wxml).toContain('Status: ready')
    expect(wxml).toContain('Greeting: Hello')
  })
})
