import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles, resolveBrowserPageStyles } from '../src/browser'

describe('browser WXSS responsive units', () => {
  it('converts imported dimensions using the simulated viewport while preserving literal strings and URLs', () => {
    const files = createBrowserVirtualFiles([
      ['app.wxss', '@import "./theme.wxss";'],
      ['theme.wxss', '.probe { --gap: 8rpx; width: 120rpx; margin: -8rpx .5rpx; height: calc(40rpx + var(--gap)); border-width: 0rpx; }'],
      ['pages/index.wxss', '.probe::before { content: "120rpx"; background: url(120rpx); --name: icon120rpx; padding: 1e2RPX; /* 8rpx */ } @media (min-width: 750rpx) { .probe { width: 20rpx; } }'],
    ])
    const styles = resolveBrowserPageStyles(files, 'pages/index', { viewportWidth: 375 })
    expect(styles.dependencies).toEqual(['app.wxss', 'theme.wxss', 'pages/index.wxss'])
    expect(styles.cssText).toContain('--gap: 4px; width: 60px; margin: -4px 0.25px; height: calc(20px + var(--gap))')
    expect(styles.cssText).toContain('border-width: 0px')
    expect(styles.cssText).toContain('content: "120rpx"; background: url(120rpx); --name: icon120rpx; padding: 50px; /* 8rpx */')
    expect(styles.cssText).toContain('@media (min-width: 375px) { .probe { width: 10px; } }')
    expect(resolveBrowserPageStyles(files, 'pages/index').cssText).toContain('width: 120rpx')
    expect(files.get('theme.wxss')).toContain('width: 120rpx')
  })

  it('tracks the session device width across resize without rewriting its virtual WXSS source', () => {
    const source = '.probe { width: 120rpx; height: 40rpx; }'
    const session = createBrowserHeadlessSession({
      files: createBrowserVirtualFiles([
        ['app.json', '{"pages":["pages/index"]}'],
        ['app.js', 'App({})'],
        ['pages/index.js', 'Page({})'],
        ['pages/index.wxml', '<view class="probe">width</view>'],
        ['pages/index.wxss', source],
      ]),
    })
    try {
      session.reLaunch('/pages/index')
      for (const [width, expectedWidth, expectedHeight] of [[375, 60, 20], [750, 120, 40], [375, 60, 20]]) {
        session.triggerResize({ size: { windowWidth: width, windowHeight: 812 } })
        expect(session.renderCurrentPage().styles.cssText).toBe(`.probe { width: ${expectedWidth}px; height: ${expectedHeight}px; }`)
      }
      expect(session.files.get('pages/index.wxss')).toBe(source)
    }
    finally {
      session.close()
    }
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid viewport width %s', (viewportWidth) => {
    expect(() => resolveBrowserPageStyles(createBrowserVirtualFiles([]), 'pages/index', { viewportWidth })).toThrow('positive finite number')
  })
})
