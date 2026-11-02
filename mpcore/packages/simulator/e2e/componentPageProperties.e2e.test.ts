import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders native Component page defaults before attachment and resets them on reLaunch', () => {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({ created: [] })'],
      ['pages/index/index.js', `Component({
        data: { source: 'data-value', local: 'local-value' },
        properties: {
          source: String,
          modelValue: { type: null, value: '' },
          explicit: { type: String, value: 'explicit-value' },
          items: { type: Array, value: ['initial'] },
          record: { type: Object, value: { count: 1 } },
        },
        lifetimes: {
          created() {
            getApp().created.push({
              source: this.properties.source,
              modelValue: this.properties.modelValue,
              explicit: this.data.explicit,
            })
          },
          attached() {
            this.setData({
              sourceFallback: this.properties.source ?? 'missing-source',
              modelFallback: this.properties.modelValue ?? 'missing-model',
            })
          },
        },
        methods: {
          createdSnapshot() { return getApp().created[getApp().created.length - 1] },
          update() {
            this.setData({ source: 'updated', modelValue: 'updated-model', 'items[0]': 'changed', 'record.count': 2 })
          },
        },
      })`],
      ['pages/index/index.wxml', `
        <view>
          <text id="source">[{{sourceFallback}}]</text>
          <text id="model">[{{modelFallback}}]</text>
          <text id="explicit">{{explicit}}</text>
          <text id="state">{{source}}|{{modelValue}}|{{items[0]}}|{{record.count}}|{{local}}</text>
        </view>
      `],
    ]),
  })
  const preview = document.createElement('div')
  document.body.append(preview)
  let previous: unknown
  try {
    for (let index = 0; index < 2; index++) {
      const page = session.reLaunch('/pages/index/index')
      expect(page).not.toBe(previous)
      expect(page.createdSnapshot()).toEqual({ source: '', modelValue: '', explicit: 'explicit-value' })
      expect(page.properties).toMatchObject({ source: '', modelValue: '', items: ['initial'], record: { count: 1 } })
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#source')?.textContent).toBe('[]')
      expect(preview.querySelector('#model')?.textContent).toBe('[]')
      expect(preview.querySelector('#explicit')?.textContent).toBe('explicit-value')
      expect(preview.querySelector('#state')?.textContent).toBe('||initial|1|local-value')

      page.update()
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#state')?.textContent).toBe('updated|updated-model|changed|2|local-value')
      expect(page.properties).toMatchObject({ source: 'updated', modelValue: 'updated-model' })
      previous = page
    }
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
