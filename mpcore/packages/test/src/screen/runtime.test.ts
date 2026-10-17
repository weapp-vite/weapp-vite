import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createTestProject } from '../project'
import { toMiniProgramSnapshot } from '../snapshot'

function createToggleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-query-toggle-'))
  const files = {
    'project.config.json': JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' }),
    'dist/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'dist/app.js': 'App({})',
    'dist/pages/index/index.json': '{}',
    'dist/pages/index/index.js': 'Page({ data: { visible: true, message: "initial" } })',
    'dist/pages/index/index.wxml': '<view wx:if="{{visible}}" data-testid="panel"><text>{{message}}</text></view>',
  }
  for (const [filePath, source] of Object.entries(files)) {
    const target = path.join(root, filePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  return root
}

it('resolves retained queries by runtime nodeId across artifact updates and conditional restoration', async () => {
  const projectPath = createToggleFixture()
  const project = createTestProject({ artifact: { projectPath } })
  try {
    const { page, screen } = await project.renderPage('/pages/index/index')
    const panel = screen.getByTestId('panel')
    const scoped = screen.within(panel)

    await page.setData({ message: 'updated' })
    await screen.refresh()
    expect(scoped.getByText('updated')).toBeDefined()
    expect(panel.textContent).toBe('updated')

    await page.setData({ visible: false })
    await screen.refresh()
    expect(panel.isConnected).toBe(false)
    expect(() => scoped.getByTestId('panel')).toThrow('within() root is no longer present')
    expect(() => toMiniProgramSnapshot(panel)).toThrow('node is no longer present')

    await page.setData({ visible: true, message: 'restored' })
    await screen.refresh()
    const restored = screen.getByTestId('panel')
    expect(restored.nodeId).toBe(panel.nodeId)
    expect(panel.isConnected).toBe(true)
    expect(panel.textContent).toBe('restored')
    expect(scoped.getByText('restored')).toBeDefined()
    expect(toMiniProgramSnapshot(scoped)).toEqual(toMiniProgramSnapshot(restored))
  }
  finally {
    try {
      await project.close()
    }
    finally {
      fs.rmSync(projectPath, { force: true, recursive: true })
    }
  }
})
