import { describe, expect, it } from 'vitest'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFiles,
} from '../src/browser'

describe('BrowserHeadlessSession', () => {
  it('runs built output from virtual files and renders wxml in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] })],
      ['app.js', 'App({ globalData: { boot: true } })'],
      ['pages/index/index.js', `
Page({
  data: {
    title: 'Browser demo',
  },
  goDetail() {
    wx.navigateTo({
      url: '/pages/detail/index?from=index',
    })
  },
})
`],
      ['pages/index/index.wxml', '<view>{{title}}</view><view bindtap="goDetail">Go</view>'],
      ['pages/detail/index.js', `
Page({
  data: {
    title: 'Detail',
  },
  onLoad(query) {
    this.setData({
      from: query?.from ?? 'unknown',
    })
  },
})
`],
      ['pages/detail/index.wxml', '<view>{{title}}</view><view>{{from}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const indexPage = session.reLaunch('/pages/index/index')
    expect(indexPage.route).toBe('pages/index/index')
    expect(session.getApp()?.globalData.boot).toBe(true)

    indexPage.goDetail()

    expect(session.renderCurrentPage().wxml).toContain('Detail')
    expect(session.renderCurrentPage().wxml).toContain('index')
  })

  it('renders custom components and routes triggerEvent back to the page', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 2,
    events: [],
  },
  handlePulse(event) {
    this.setData({
      events: [...this.data.events, event?.detail?.phase ?? 'none'],
      count: this.data.count + 1,
    })
  },
})
`],
      ['pages/lab/index.wxml', `
<view>Lab</view>
<status-card count="{{count}}" bind:pulse="handlePulse" />
<view>{{events.0}}</view>
`],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    }
  },
  data: {
    observerLog: 'cold'
  },
  observers: {
    count() {
      this.setData({
        observerLog: 'count:' + this.properties.count
      })
    }
  },
  methods: {
    pulse() {
      this.triggerEvent('pulse', {
        phase: 'component-click'
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', `
<view>Count: {{count}}</view>
<view>{{observerLog}}</view>
<view bindtap="pulse">trigger</view>
`],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')

    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('Count: 2')
    expect(rendered.wxml).toContain('count:2')

    const scopes = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    session.callTapBinding(componentScopeId!, 'pulse')

    const rerendered = session.renderCurrentPage()
    expect(rerendered.wxml).toContain('component-click')
    expect(rerendered.wxml).toContain('Count: 3')
    expect(rerendered.wxml).toContain('count:3')
  })
})
