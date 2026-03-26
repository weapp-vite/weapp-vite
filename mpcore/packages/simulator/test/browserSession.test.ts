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

  it('passes current values into component observer arguments', () => {
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
    status: 'stable'
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    observerArgs: ''
  },
  observers: {
    'count, status'(count, status) {
      this.setData({
        observerArgs: JSON.stringify({ count, status })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{observerArgs}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"count":2')
    expect(rendered.wxml).toContain('"status":"stable"')
  })

  it('runs property-level observers with the current property value', () => {
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
    status: 'stable'
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: '',
      observer(value) {
        this.setData({
          propertyObserverLog: 'status:' + value
        })
      }
    }
  },
  data: {
    propertyObserverLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propertyObserverLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('status:stable')
  })

  it('passes previous values into property-level observers', () => {
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
    status: 'stable'
  },
  flip() {
    this.setData({
      status: 'boosted'
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" /><view bindtap="flip">flip</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: '',
      observer(value, oldValue) {
        this.setData({
          propertyObserverLog: JSON.stringify({ value, oldValue })
        })
      }
    }
  },
  data: {
    propertyObserverLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propertyObserverLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"value":"stable"')
    expect(rendered.wxml).not.toContain('"oldValue"')

    page.flip()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"value":"boosted"')
    expect(rendered.wxml).toContain('"oldValue":"stable"')
  })

  it('coerces basic property types for component props', () => {
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
    enabled: '',
    status: 42
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" enabled="{{enabled}}" status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    enabled: {
      type: Boolean,
      value: false
    },
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    propTypes: ''
  },
  observers: {
    'count, enabled, status'(count, enabled, status) {
      this.setData({
        propTypes: JSON.stringify({
          countType: typeof count,
          enabledType: typeof enabled,
          enabledValue: enabled,
          statusType: typeof status,
          statusValue: status
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propTypes}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"countType":"number"')
    expect(rendered.wxml).toContain('"enabledType":"boolean"')
    expect(rendered.wxml).toContain('"enabledValue":true')
    expect(rendered.wxml).toContain('"statusType":"string"')
    expect(rendered.wxml).toContain('"statusValue":"42"')
  })

  it('supports shorthand property declarations for basic types', () => {
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
    count: 7,
    enabled: '',
    title: 1234
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" enabled="{{enabled}}" title="{{title}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: Number,
    enabled: Boolean,
    title: String
  },
  data: {
    propTypes: ''
  },
  observers: {
    'count, enabled, title'(count, enabled, title) {
      this.setData({
        propTypes: JSON.stringify({
          count,
          countType: typeof count,
          enabled,
          enabledType: typeof enabled,
          title,
          titleType: typeof title
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propTypes}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"count":7')
    expect(rendered.wxml).toContain('"countType":"number"')
    expect(rendered.wxml).toContain('"enabled":true')
    expect(rendered.wxml).toContain('"enabledType":"boolean"')
    expect(rendered.wxml).toContain('"title":"1234"')
    expect(rendered.wxml).toContain('"titleType":"string"')
  })

  it('supports optionalTypes for component properties', () => {
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
    count: 7
  }
})
`],
      ['pages/lab/index.wxml', '<status-card mixed="{{count}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mixed: {
      type: String,
      optionalTypes: [Number],
      value: ''
    }
  },
  data: {
    summary: ''
  },
  observers: {
    mixed(value) {
      this.setData({
        summary: JSON.stringify({
          type: typeof value,
          value
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"type":"number"')
    expect(rendered.wxml).toContain('"value":7')
  })

  it('allows passthrough component properties when type is null', () => {
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
    payload: {
      level: 3
    }
  }
})
`],
      ['pages/lab/index.wxml', '<status-card mixed="{{payload}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mixed: {
      type: null,
      value: null
    }
  },
  data: {
    summary: ''
  },
  observers: {
    mixed(value) {
      this.setData({
        summary: JSON.stringify({
          isObject: !!value && typeof value === 'object' && !Array.isArray(value),
          level: value?.level ?? 0
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"isObject":true')
    expect(rendered.wxml).toContain('"level":3')
  })

  it('falls back to property default values when page props become nullish', () => {
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
    status: 'stable'
  },
  clearStatus() {
    this.setData({
      status: undefined
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" /><view bindtap="clearStatus">clear</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: 'idle'
    }
  },
  data: {
    summary: ''
  },
  observers: {
    status(value) {
      this.setData({
        summary: String(value)
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('stable')

    page.clearStatus()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('idle')
  })

  it('supports function-based property default values', () => {
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
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('status-card')
    this.setData({
      summary: JSON.stringify(card?.properties?.meta ?? {})
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    meta: {
      type: Object,
      value() {
        return {
          owner: 'factory'
        }
      }
    }
  },
  data: {
    summary: ''
  },
  observers: {
    meta(value) {
      this.setData({
        summary: JSON.stringify(value)
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"owner":"factory"')
  })

  it('supports top-level component lifecycle hooks without lifetimes wrapper', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/a/index', 'pages/b/index'] })],
      ['app.js', 'App({})'],
      ['pages/a/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/a/index.js', 'Page({ openB() { wx.reLaunch({ url: "/pages/b/index" }) } })'],
      ['pages/a/index.wxml', '<status-card /><view bindtap="openB">next</view>'],
      ['pages/b/index.js', 'Page({})'],
      ['pages/b/index.wxml', '<view>B</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  data: {
    lifecycleLog: []
  },
  created() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'created']
    })
  },
  attached() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'attached']
    })
  },
  ready() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'ready']
    })
  },
  detached() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'detached']
    })
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{lifecycleLog.0}}</view><view>{{lifecycleLog.1}}</view><view>{{lifecycleLog.2}}</view><view>{{lifecycleLog.3}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const pageA = session.reLaunch('/pages/a/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('created')
    expect(rendered.wxml).toContain('attached')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('ready')

    const scopes = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    pageA.openB()
    const componentScope = session.getScopeSnapshot(componentScopeId!)
    expect(componentScope).toBeNull()
  })

  it('merges basic Behavior fields into component instances', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { count: 2 } })'],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
const shared = Behavior({
  properties: {
    count: Number
  },
  data: {
    fromBehavior: 'yes'
  },
  methods: {
    ping() {
      return 'pong'
    }
  },
  observers: {
    count(count) {
      this.setData({
        observerLog: 'count:' + count
      })
    }
  }
})

Component({
  behaviors: [shared],
  data: {
    observerLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{fromBehavior}}</view><view>{{observerLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('yes')
    expect(rendered.wxml).toContain('count:2')

    const card = session.selectComponent('status-card')
    expect(card?.ping?.()).toBe('pong')
  })

  it('preserves array and object property structures from page data', () => {
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
    filters: ['hot', 'new'],
    meta: {
      owner: 'ops'
    }
  }
})
`],
      ['pages/lab/index.wxml', '<status-card filters="{{filters}}" meta="{{meta}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    filters: Array,
    meta: Object
  },
  data: {
    payload: ''
  },
  observers: {
    'filters, meta'(filters, meta) {
      this.setData({
        payload: JSON.stringify({
          filterSize: filters?.length ?? 0,
          first: filters?.[0] ?? '',
          owner: meta?.owner ?? ''
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{payload}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"filterSize":2')
    expect(rendered.wxml).toContain('"first":"hot"')
    expect(rendered.wxml).toContain('"owner":"ops"')
  })

  it('clones array and object default property values per component instance', () => {
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
    title: 'main',
    summary: ''
  },
  inspect() {
    const cards = this.selectAllComponents('status-card')
    cards[0]?.properties?.filters?.push('first')
    cards[0]?.properties?.meta && (cards[0].properties.meta.owner = 'mutated')
    this.setData({
      summary: JSON.stringify({
        firstFilters: cards[0]?.properties?.filters ?? [],
        secondFilters: cards[1]?.properties?.filters ?? [],
        firstOwner: cards[0]?.properties?.meta?.owner ?? '',
        secondOwner: cards[1]?.properties?.meta?.owner ?? ''
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    filters: {
      type: Array,
      value: []
    },
    meta: {
      type: Object,
      value: {
        owner: 'default'
      }
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{filters.length}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"firstFilters":["first"]')
    expect(page.data.summary).toContain('"secondFilters":[]')
    expect(page.data.summary).toContain('"firstOwner":"mutated"')
    expect(page.data.summary).toContain('"secondOwner":"default"')
  })

  it('runs component pageLifetimes on page show hide and resize', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/a/index', 'pages/b/index'] })],
      ['app.js', 'App({})'],
      ['pages/a/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/a/index.js', 'Page({ openB() { wx.navigateTo({ url: "/pages/b/index" }) } })'],
      ['pages/a/index.wxml', '<status-card mode="{{\'A\'}}" /><view bindtap="openB">next</view>'],
      ['pages/b/index.js', 'Page({})'],
      ['pages/b/index.wxml', '<view>B</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mode: {
      type: String,
      value: ''
    }
  },
  data: {
    lifecycleLog: []
  },
  pageLifetimes: {
    show() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'show']
      })
    },
    hide() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'hide']
      })
    },
    resize(options) {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'resize:' + options?.size?.windowWidth]
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{mode}}</view><view>{{lifecycleLog.0}}</view><view>{{lifecycleLog.1}}</view><view>{{lifecycleLog.2}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const pageA = session.reLaunch('/pages/a/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('show')
    const scopes = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    session.triggerResize({
      size: {
        windowWidth: 375,
      },
    })
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('resize:375')

    pageA.openB()
    const componentScope = session.getScopeSnapshot(componentScopeId!)
    expect(componentScope?.data.lifecycleLog).toEqual(['show', 'resize:375', 'hide'])
  })

  it('supports selectComponent and selectAllComponents from the page instance', () => {
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
    snapshot: ''
  },
  inspect() {
    const card = this.selectComponent('#status-card')
    const cards = this.selectAllComponents('status-card')
    this.setData({
      snapshot: JSON.stringify({
        count: card?.properties?.count,
        hasPulse: typeof card?.pulse === 'function',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card id="status-card" count="{{count}}" /><view bindtap="inspect">inspect</view><view>{{snapshot}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    }
  },
  methods: {
    pulse() {}
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{count}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()

    expect(page.data.snapshot).toContain('"count":2')
    expect(page.data.snapshot).toContain('"hasPulse":true')
    expect(page.data.snapshot).toContain('"size":1')
  })

  it('supports selecting component instances by class selector', () => {
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
    title: 'main',
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('.primary-card')
    const cards = this.selectAllComponents('.primary-card')
    this.setData({
      summary: JSON.stringify({
        title: card?.properties?.title ?? '',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card class="primary-card" title="{{title}}" /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    title: String
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{title}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"title":"main"')
    expect(page.data.summary).toContain('"size":1')
  })

  it('supports selecting component instances by data attribute selector', () => {
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
    title: 'main',
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('[data-role="primary"]')
    const cards = this.selectAllComponents('[data-role="primary"]')
    this.setData({
      summary: JSON.stringify({
        title: card?.properties?.title ?? '',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card data-role="primary" title="{{title}}" /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    title: String
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{title}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"title":"main"')
    expect(page.data.summary).toContain('"size":1')
  })

  it('supports nested component selection and component created ready lifetimes', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { result: "", status: "stable" }, handlePulse(event) { this.setData({ result: event?.detail?.phase ?? "" }) } })'],
      ['pages/lab/index.wxml', '<status-card id="status-card" status="{{status}}" bind:pulse="handlePulse" /><view>{{result}}</view>'],
      ['components/status-card/index.json', JSON.stringify({
        usingComponents: {
          'mini-badge': '../mini-badge/index',
        },
      })],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    nested: ''
  },
  methods: {
    inspectNested() {
      const badge = this.selectComponent('#mini-badge')
      const badges = this.selectAllComponents('mini-badge')
      this.setData({
        nested: JSON.stringify({
          label: badge?.properties?.label ?? '',
          size: badges.length
        })
      })
      this.triggerEvent('pulse', {
        phase: this.data.nested
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<mini-badge id="mini-badge" label="{{status}}" /><view bindtap="inspectNested">inspect nested</view><view>{{nested}}</view>'],
      ['components/mini-badge/index.json', '{}'],
      ['components/mini-badge/index.js', `
Component({
  properties: {
    label: {
      type: String,
      value: ''
    }
  },
  data: {
    readyState: 'cold'
  },
  lifetimes: {
    created() {
      this.setData({ readyState: 'created' })
    },
    ready() {
      this.setData({ readyState: 'ready' })
    }
  }
})
`],
      ['components/mini-badge/index.wxml', '<view>{{label}}</view><view>{{readyState}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('created')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('ready')

    const scopeIds = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card') && !scopeId.includes('mini-badge'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBinding(statusCardScopeId!, 'inspectNested')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"label":"stable"')
    expect(rendered.wxml).toContain('"size":1')
  })

  it('passes triggerEvent options and event target shape back to the page', () => {
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
    snapshot: ''
  },
  handlePulse(event) {
    this.setData({
      snapshot: JSON.stringify({
        bubbles: event?.bubbles ?? false,
        composed: event?.composed ?? false,
        id: event?.target?.id ?? ''
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card id="status-card" bind:pulse="handlePulse" /><view>{{snapshot}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  methods: {
    pulse() {
      this.triggerEvent('pulse', {
        phase: 'shape'
      }, {
        bubbles: true,
        composed: true
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view bindtap="pulse">pulse</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBindingWithEvent(statusCardScopeId!, 'pulse', {
      dataset: {
        cardType: 'primary',
        phase: 'pulse',
      },
      id: 'pulse-node',
    })
    const page = session.getCurrentPages()[0]
    expect(page?.data.snapshot).toContain('"bubbles":true')
    expect(page?.data.snapshot).toContain('"composed":true')
    expect(page?.data.snapshot).toContain('"id":"pulse-node"')
  })

  it('supports selectOwnerComponent from nested component instances', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { status: "stable" } })'],
      ['pages/lab/index.wxml', '<status-card id="status-card" status="{{status}}" />'],
      ['components/status-card/index.json', JSON.stringify({
        usingComponents: {
          'mini-badge': '../mini-badge/index',
        },
      })],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: ''
    }
  }
})
`],
      ['components/status-card/index.wxml', '<mini-badge id="mini-badge" label="{{status}}" />'],
      ['components/mini-badge/index.json', '{}'],
      ['components/mini-badge/index.js', `
Component({
  properties: {
    label: {
      type: String,
      value: ''
    }
  },
  data: {
    ownerSnapshot: ''
  },
  methods: {
    inspectOwner() {
      const owner = this.selectOwnerComponent?.()
      this.setData({
        ownerSnapshot: JSON.stringify({
          hasOwner: !!owner,
          status: owner?.properties?.status ?? ''
        })
      })
    }
  }
})
`],
      ['components/mini-badge/index.wxml', '<view bindtap="inspectOwner">inspect owner</view><view>{{ownerSnapshot}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    const scopeIds = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const badgeScopeId = scopeIds.find(scopeId => scopeId.includes('mini-badge'))
    expect(badgeScopeId).toBeTruthy()

    session.callTapBinding(badgeScopeId!, 'inspectOwner')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"hasOwner":true')
    expect(rendered.wxml).toContain('"status":"stable"')
  })

  it('maps data attributes into event target dataset', () => {
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
    snapshot: ''
  },
  handlePulse(event) {
    this.setData({
      snapshot: JSON.stringify(event?.target?.dataset ?? {})
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card bind:pulse="handlePulse" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  methods: {
    pulse() {
      this.triggerEvent('pulse', {}, {
        bubbles: true
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view id="pulse-node" data-phase="pulse" data-card-type="primary" bindtap="pulse">pulse</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = [...rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g)].map(match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBindingWithEvent(statusCardScopeId!, 'pulse', {
      dataset: {
        cardType: 'primary',
        phase: 'pulse',
      },
      id: 'pulse-node',
    })
    const page = session.getCurrentPages()[0]
    expect(page?.data.snapshot).toContain('"phase":"pulse"')
    expect(page?.data.snapshot).toContain('"cardType":"primary"')
  })
})
