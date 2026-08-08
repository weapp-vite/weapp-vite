import type { MiniProgramRenderResult } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestProject } from './project'

function writeFile(root: string, filePath: string, source: string) {
  const target = path.join(root, filePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-test-'))
  writeFile(root, 'project.config.json', JSON.stringify({
    appid: 'wx123',
    miniprogramRoot: 'dist',
  }))
  writeFile(root, 'dist/app.json', JSON.stringify({ pages: ['pages/index/index'] }))
  writeFile(root, 'dist/app.js', 'App({})\n')
  writeFile(root, 'dist/pages/index/index.js', `
Page({
  data: { count: 1, query: '' },
  onLoad(query) { this.setData({ query: query.from || '' }) },
  increment() { this.setData({ count: this.data.count + 1 }) },
  logWarning() { console.warn('expected warning') },
  logError() { console.error('expected error') },
  requestWithoutMock() { return wx.request({ url: 'https://unmatched.mpcore.dev' }) },
  scheduleIncrement() {
    setTimeout(() => this.setData({ count: this.data.count + 1 }), 20)
  },
  scheduleFailure() {
    setTimeout(() => { throw new Error('scheduled failure') }, 20)
  },
})
`)
  writeFile(root, 'dist/pages/index/index.wxml', `
<view data-testid="page" data-kind="counter">
  <button aria-label="增加" bindtap="increment">增加</button>
  <text>count: {{count}}</text>
  <text>query: {{query}}</text>
</view>
`)
  writeFile(root, 'dist/components/counter/index.json', '{}')
  writeFile(root, 'dist/components/counter/index.js', `
Component({
  properties: { value: { type: Number, value: 0 } },
  data: { count: 0 },
  lifetimes: {
    attached() { this.setData({ count: this.properties.value }) },
  },
  methods: {
    increment() {
      const count = this.data.count + 1
      this.setData({ count })
      this.triggerEvent('change', { value: count })
    },
  },
})
`)
  writeFile(root, 'dist/components/counter/index.wxml', `
<view data-testid="counter">
  <button aria-label="增加" bindtap="increment">增加</button>
  <text>{{count}}</text>
  <slot />
</view>
`)
  return root
}

describe('@mpcore/test', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it('renders pages with route query and Testing Library-style queries', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const project = createTestProject({ artifact: { projectPath } })
    const result = await project.renderPage('/pages/index/index?from=test')

    expect(result.screen.getByText('query: test')).toBeDefined()
    expect(result.screen.getByTestId('page').dataset).toEqual({
      kind: 'counter',
      testid: 'page',
    })
    await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
    expect(result.screen.getByText('count: 2')).toBeDefined()

    await project.close()
    expect(() => result.screen.getByText('count: 2').textContent).toThrow('closed')
  })

  it('supports get, query, find, getAll and within variants', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const project = createTestProject({ artifact: { projectPath } })
    const result = await project.renderPage('/pages/index/index')
    const root = result.screen.getByTestId('page')
    const scoped = result.screen.within(root)

    expect(result.screen.queryByText('missing')).toBeNull()
    expect(result.screen.queryAllByRole('button')).toHaveLength(1)
    expect(result.screen.getAllByAttribute('data-kind', /counter/)).toHaveLength(1)
    expect(scoped.getByRole('button', { name: '增加' })).toBeDefined()
    await expect(result.screen.findByText('count: 1')).resolves.toBeDefined()
    await expect(result.screen.findAllByTestId('page')).resolves.toHaveLength(1)

    await project.close()
  })

  it('renders components from an in-memory host overlay and records events', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const listener = vi.fn()
    const project = createTestProject({ artifact: { projectPath } })
    const result = await project.renderComponent('components/counter/index', {
      on: { change: listener },
      properties: { value: 1 },
      slots: { default: '<text>计数器</text>' },
    })

    expect(result.screen.getByText('计数器')).toBeDefined()
    expect(result.screen.within(result.screen.getByTestId('counter')).getByText('1')).toBeDefined()
    await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
    expect(result.emitted('change')).toEqual([{ value: 2 }])
    expect(listener).toHaveBeenCalledWith({ value: 2 }, expect.any(Object))

    await result.close()
  })

  it('isolates concurrent sessions and cleanup', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const first = createTestProject({ artifact: { projectPath } })
    const second = createTestProject({ artifact: { projectPath } })
    const [firstResult, secondResult] = await Promise.all([
      first.renderPage('/pages/index/index'),
      second.renderPage('/pages/index/index'),
    ])

    await firstResult.user.tap(firstResult.screen.getByRole('button'))
    expect(firstResult.screen.getByText('count: 2')).toBeDefined()
    expect(secondResult.screen.getByText('count: 1')).toBeDefined()

    await Promise.all([first.close(), second.close()])
  })

  it('repeats render and cleanup without retaining active handles', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const project = createTestProject({ artifact: { projectPath } })
    const results: MiniProgramRenderResult[] = []

    for (let index = 0; index < 100; index++) {
      const result = await project.renderComponent('components/counter/index', {
        properties: { value: index },
      })
      results.push(result)
      await result.close()
    }

    await project.close()
    expect(() => results[0]!.screen.getByText('0')).toThrow('closed')
    expect(() => results.at(-1)!.screen.getByText('99')).toThrow('closed')
  })

  it('reports warnings and allows explicitly expected console errors', async () => {
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const project = createTestProject({
      artifact: { projectPath },
      failOnConsoleError: false,
    })
    const result = await project.renderPage('/pages/index/index')

    await result.page.callMethod('logWarning')
    await result.page.callMethod('logError')
    expect(result.diagnostics()).toEqual([
      expect.objectContaining({ level: 'warn' }),
      expect.objectContaining({ level: 'error' }),
    ])

    await expect(project.close()).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith('expected error')
    expect(warningSpy).toHaveBeenCalledWith('expected warning')
  })

  it('fails cleanup on console errors and asynchronous exceptions', async () => {
    vi.useFakeTimers()
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const project = createTestProject({ artifact: { projectPath } })
    const result = await project.renderPage('/pages/index/index')

    await result.page.callMethod('logError')
    await result.page.callMethod('scheduleFailure')
    await vi.advanceTimersByTimeAsync(20)

    await expect(project.close()).rejects.toThrow('scheduled failure')
    expect(errorSpy).toHaveBeenCalledWith('expected error')
  })

  it('uses fake timers without leaking scheduled work and rejects unmatched host calls', async () => {
    vi.useFakeTimers()
    const projectPath = createFixture()
    tempDirs.push(projectPath)
    const project = createTestProject({ artifact: { projectPath } })
    const result = await project.renderPage('/pages/index/index')

    await expect(result.page.callMethod('requestWithoutMock')).rejects.toThrow('No request mock matched')
    await result.page.callMethod('scheduleIncrement')
    await vi.advanceTimersByTimeAsync(20)
    await result.screen.refresh()
    expect(result.screen.getByText('count: 2')).toBeDefined()

    await project.close()
  })
})
