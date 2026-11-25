import type { MiniProgramRenderResult } from '@mpcore/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { createVitestProject } from './index'

function writeFile(root: string, filePath: string, source: string) {
  const target = path.join(root, filePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-vitest-concurrent-'))
writeFile(projectPath, 'project.config.json', JSON.stringify({
  appid: 'wx123',
  miniprogramRoot: 'dist',
}))
writeFile(projectPath, 'dist/app.json', JSON.stringify({ pages: ['pages/index/index'] }))
writeFile(projectPath, 'dist/app.js', 'App({})\n')
writeFile(projectPath, 'dist/pages/index/index.js', `
Page({
  data: { count: 0 },
  increment() { this.setData({ count: this.data.count + 1 }) },
})
`)
writeFile(projectPath, 'dist/pages/index/index.wxml', `
<button aria-label="increment" bindtap="increment">increment</button>
<text>count: {{count}}</text>
`)

const completedRenders: MiniProgramRenderResult[] = []
async function verifyIsolatedSession() {
  const mpcore = createVitestProject({ artifact: { projectPath } })
  const result = await mpcore.renderPage('/pages/index/index')
  completedRenders.push(result)
  await result.user.tap(result.screen.getByRole('button', { name: 'increment' }))
  expect(result.screen.getByText('count: 1')).toBeDefined()
}

it.concurrent('isolates and cleans the first concurrent session', verifyIsolatedSession)
it.concurrent('isolates and cleans the second concurrent session', verifyIsolatedSession)

afterAll(() => {
  expect(completedRenders).toHaveLength(2)
  for (const result of completedRenders) {
    expect(() => result.screen.getByText('count: 1')).toThrow('closed')
  }
  fs.rmSync(projectPath, { force: true, recursive: true })
})
