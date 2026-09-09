import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestProject } from './project'

describe('component user interactions', () => {
  const cleanups: (() => Promise<void>)[] = []

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup()
    }
  })

  async function render() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-user-'))
    cleanups.push(async () => fs.rmSync(root, { force: true, recursive: true }))
    const files: Record<string, string> = {
      'project.config.json': JSON.stringify({ miniprogramRoot: '.' }),
      'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'app.js': 'App({})',
      'pages/index/index.json': JSON.stringify({ usingComponents: { outer: '/components/outer/index' } }),
      'pages/index/index.js': `Page({
        data: { projected: 0 },
        increment() { this.setData({ projected: this.data.projected + 1 }) },
      })`,
      'pages/index/index.wxml': `<outer>
        <button data-testid="projected" bindtap="increment">Projected {{projected}}</button>
      </outer>`,
      'components/outer/index.json': JSON.stringify({
        component: true,
        usingComponents: { counter: '/components/counter/index' },
      }),
      'components/outer/index.js': 'Component({})',
      'components/outer/index.wxml': `<view>
        <counter label="first" />
        <counter label="second" />
        <slot />
      </view>`,
      'components/counter/index.json': JSON.stringify({ component: true }),
      'components/counter/index.js': `Component({
        properties: { label: String },
        data: { count: 0, value: '', visible: true },
        methods: {
          increment() { this.setData({ count: this.data.count + 1 }) },
          edit(event) { this.setData({ value: event.detail.value }) },
          remove() { this.setData({ visible: false }) },
        },
      })`,
      'components/counter/index.wxml': `<view data-testid="{{label}}">
        <button wx:if="{{visible}}" bindtap="increment">Increase</button>
        <button bindtap="remove">Remove</button>
        <input aria-label="Value" bindinput="edit" />
        <text>{{label}} count: {{count}}</text>
        <text>{{label}} value: {{value}}</text>
      </view>`,
    }
    for (const [relativePath, source] of Object.entries(files)) {
      const filePath = path.join(root, relativePath)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, source)
    }
    const project = createTestProject({ artifact: { projectPath: root } })
    cleanups.push(() => project.close())
    return await project.renderPage('/pages/index/index')
  }

  it('interacts with the selected nested instance while page queries remain isolated', async () => {
    const { page, screen, user } = await render()
    expect(await page.$('input')).toBeNull()
    expect(await page.$$('button')).toHaveLength(1)

    const first = screen.within(screen.getByTestId('first'))
    const second = screen.within(screen.getByTestId('second'))
    await user.tap(second.getByRole('button', { name: 'Increase' }))
    expect(screen.getByText('first count: 0')).toBeDefined()
    expect(screen.getByText('second count: 1')).toBeDefined()

    await user.input(first.getByRole('textbox', { name: 'Value' }), 'edited')
    expect(screen.getByText('first value: edited')).toBeDefined()
    expect(screen.getByText('second value:')).toBeDefined()

    await user.tap(screen.getByTestId('projected'))
    expect(screen.getByText('Projected 1')).toBeDefined()
    expect(screen.getByText('second count: 1')).toBeDefined()
  })

  it('rejects a removed component node without interacting with its sibling', async () => {
    const { screen, user } = await render()
    const second = screen.within(screen.getByTestId('second'))
    const removed = second.getByRole('button', { name: 'Increase' })
    await user.tap(second.getByRole('button', { name: 'Remove' }))
    await expect(user.tap(removed)).rejects.toThrow('no longer available for interaction')
    expect(screen.getByText('first count: 0')).toBeDefined()
    expect(screen.getByText('second count: 0')).toBeDefined()
  })
})
