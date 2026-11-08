import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createPackageWasmFiles } from '../test/helpers/packageWasmFiles'

it('renders real package WASM execution and a lossless binary snapshot in an isolated browser session', async () => {
  const original = globalThis.WebAssembly
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createPackageWasmFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index')
    await page.run()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#result')?.textContent).toBe('42')
    expect(preview.querySelector('#bytes')?.textContent).toBe('0,255,128,42')
    expect(globalThis.WebAssembly).toBe(original)
    page.remove()
    expect(() => page.snapshotSize()).toThrow('no such file')
  }
  finally {
    session.close()
    preview.remove()
  }
})
