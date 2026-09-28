import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulStoreBindingFiles } from './helpers/statefulStoreBindings'

it('keeps SFC Store bindings reactive across template restoration and retains only Store state on relaunch', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stateful-store-'))
  for (const [file, source] of await createStatefulStoreBindingFiles()) {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  const session = createHeadlessSession({ projectPath: root })
  try {
    const page = session.reLaunch('/pages/wevu/index')
    expect(session.renderCurrentPage().wxml).toMatch(/class="store-count"[^>]*>0<\/view>/)
    page.increment()
    page.increment()
    await expect.poll(() => session.renderCurrentPage().wxml).toMatch(/class="store-count"[^>]*>2<\/view>/)
    expect(session.renderCurrentPage().wxml).toMatch(/class="count"[^>]*>2<\/view>/)
    const templatePath = path.join(root, 'pages/wevu/index.wxml')
    const original = fs.readFileSync(templatePath, 'utf8')
    const updated = `<view class="template-probe">template edit</view>${original}`
    let count = 2
    for (const template of [updated, original]) {
      fs.writeFileSync(templatePath, template)
      expect(session.renderCurrentPage().wxml.includes('template-probe')).toBe(template === updated)
      expect(session.getCurrentPages()[0]).toBe(page)
      page.increment()
      count += 1
      await expect.poll(() => session.renderCurrentPage().wxml).toMatch(new RegExp(`class="store-count"[^>]*>${count}</view>`))
      expect(page.data.count).toBe(count)
    }
    session.reLaunch('/pages/wevu/index')
    expect(session.renderCurrentPage().wxml).toMatch(/class="store-count"[^>]*>4<\/view>/)
    expect(session.renderCurrentPage().wxml).toMatch(/class="count"[^>]*>0<\/view>/)
  }
  finally {
    session.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})
