import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

function createPreview(label: string) {
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index'] })],
      ['app.js', 'require("./runtime"); App({ label: miniAppShared.label });'],
      ['runtime.js', `globalThis.miniAppShared = { label: ${JSON.stringify(label)}, value: 1 };`],
      ['pages/index.js', `
        'use strict';
        const readValue = () => miniAppShared.value;
        require('../update');
        Page({
          data: { label: getApp().label, value: readValue(), status: moduleStatus },
          async advance() {
            await Promise.resolve();
            globalThis.miniAppShared = { ...miniAppShared, value: readValue() + 1 };
            this.setData({ value: readValue() });
          },
        });
      `],
      ['update.js', 'globalThis.miniAppShared = { ...miniAppShared, value: 2 }; globalThis.moduleStatus = "ready";'],
      ['pages/index.wxml', '<view class="label">{{label}}</view><view class="value">{{value}}</view><view class="status">{{status}}</view><button class="advance" bindtap="advance">advance</button>'],
    ]),
  })
  const preview = document.createElement('div')
  document.body.append(preview)
  return {
    session,
    preview,
    render() {
      preview.innerHTML = session.renderCurrentPage().wxml
    },
    close() {
      session.close()
      preview.remove()
    },
  }
}

it('renders live dependency globals and keeps asynchronous module updates inside each browser session', async () => {
  const hostBefore = Object.getOwnPropertyDescriptor(globalThis, 'miniAppShared')
  const first = createPreview('first')
  const second = createPreview('second')
  try {
    first.session.reLaunch('/pages/index')
    second.session.reLaunch('/pages/index')
    first.render()
    second.render()
    expect(first.preview.querySelector('.label')?.textContent).toBe('first')
    expect(second.preview.querySelector('.label')?.textContent).toBe('second')
    expect(first.preview.querySelector('.value')?.textContent).toBe('2')
    expect(second.preview.querySelector('.value')?.textContent).toBe('2')
    expect(first.preview.querySelector('.status')?.textContent).toBe('ready')
    const button = first.preview.querySelector<HTMLButtonElement>('.advance')!
    expect(button).not.toBeNull()
    await first.session.callScopeMethod(button.dataset.simScope!, button.dataset.simTap!)
    first.render()
    second.render()
    expect(first.preview.querySelector('.value')?.textContent).toBe('3')
    expect(second.preview.querySelector('.value')?.textContent).toBe('2')
    expect(Object.getOwnPropertyDescriptor(globalThis, 'miniAppShared')).toEqual(hostBefore)
  }
  finally {
    first.close()
    second.close()
  }
})
