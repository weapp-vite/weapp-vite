import type { PropsProjectionFixture } from '../test/helpers/propsProjection'
// @ts-expect-error Node 侧编译真实 Issue fixture，浏览器复用相同脚本、模板及配置。
import fixture from 'virtual:merge-models-projection-fixture'
import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

function bindingFor(bindings: PropsProjectionFixture['bindings'], sourceRoot: string) {
  const binding = bindings['pages/index/index']?.find(item => item.sourceRoots.includes(sourceRoot))
  expect(binding, `Missing binding for ${sourceRoot}`).toBeDefined()
  return binding!.outputPath
}

it('renders mergeModels props with direct unrelated bindings in the browser', async () => {
  const { files, bindings } = fixture as PropsProjectionFixture
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    let page = session.reLaunch('/pages/index/index')
    const check = async (updated = false) => vi.waitFor(() => {
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(page.data[bindingFor(bindings, 'modelValue')]).toBe('modelValue')
      expect(preview.querySelector('#model-value')?.textContent).toBe('modelValue')
      for (const [selector, text] of [
        ['#change', updated ? 'updated-change' : 'change'],
        ['#select-a', updated ? 'updated-a' : 'selectA'],
        ['#select-b', updated ? 'updated-b' : 'selectB'],
        ['#local-visible', updated ? 'false' : 'true'],
        ['#local-result', updated ? 'updated-result' : 'localResult'],
        ['#has-next', updated ? 'false' : 'true'],
      ] as const) {
        expect(preview.querySelector(selector)?.textContent).toBe(text)
      }
    })
    await check()
    page.changeBindings()
    await check(true)
    const previous = page
    const reopened = session.reLaunch('/pages/index/index')
    expect(reopened).not.toBe(previous)
    page = reopened
    await check()
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
