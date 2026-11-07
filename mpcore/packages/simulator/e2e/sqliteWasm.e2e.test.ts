// @ts-expect-error Node 侧读取真实 SQLite 引擎，浏览器消费相同包内源码和二进制。
import sources from 'virtual:sqlite-wasm-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders real SQL values after closing and reopening the binary database snapshot', async () => {
  const files = (sources as Array<[string, string | number[]]>).map(([file, content]): [string, string | ArrayBuffer] => [file, typeof content === 'string' ? content : new Uint8Array(content).buffer])
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index')
    await page.run()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#value')?.textContent).toBe('1303')
    expect(preview.querySelector('#text')?.textContent).toBe('数据库')
    expect(preview.querySelector('#snapshot')?.textContent).toBe('true')
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
