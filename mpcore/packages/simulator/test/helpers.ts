import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function writeJson(target: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value, null, 2))
}

function writeScript(target: string, source: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

function writeText(target: string, source: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

export function cleanupTempDirs(tempDirs: string[]) {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

export function createBaseFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-base-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/index/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    __e2eAsyncCount: 0,
    __e2eAsyncText: '',
    __e2eData: {
      greeting: 'Hello',
      target: 'index snapshot',
    },
    __e2eBlur: null,
    __e2eChange: null,
    __e2eInput: null,
    __e2eResult: {
      status: 'ready',
      detail: 'rendered',
    },
    __e2eTap: null,
  },
  onTap(event) {
    this.setData({
      '__e2eResult.status': 'tapped',
      '__e2eResult.detail': 'tap handled',
      __e2eTap: {
        currentTarget: event?.currentTarget ?? null,
        target: event?.target ?? null,
      },
    })
  },
  onInput(event) {
    this.setData({
      __e2eInput: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
  onChange(event) {
    this.setData({
      __e2eChange: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
  onBlur(event) {
    this.setData({
      __e2eBlur: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
  showAsyncText() {
    setTimeout(() => {
      this.setData({
        __e2eAsyncText: 'async ready',
      })
    }, 20)
  },
  clearAsyncText() {
    setTimeout(() => {
      this.setData({
        __e2eAsyncText: '',
      })
    }, 20)
  },
  bumpAsyncCount() {
    setTimeout(() => {
      this.setData({
        __e2eAsyncCount: this.data.__e2eAsyncCount + 2,
      })
    }, 20)
  },
  runNextTickUpdate() {
    this.setData({
      '__e2eResult.status': 'next-tick-ready',
      '__e2eResult.detail': 'pending',
    })
    wx.nextTick(() => {
      this.setData({
        '__e2eResult.detail': this.data.__e2eResult.status,
      })
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/index/index.wxml'), `
<view id="greeting-button" data-phase="initial" data-card-type="primary" bind:tap="onTap">{{__e2eData.greeting}}</view>
<input id="greeting-input" data-field="greeting" bindinput="onInput" bindchange="onChange" bindblur="onBlur" value="{{__e2eData.greeting}}" />
<view id="async-text">{{__e2eAsyncText}}</view>
<view id="async-count">{{__e2eAsyncCount}}</view>
<view class="panel-row">Status: {{__e2eResult.status}}</view>
<view class="panel-row">Detail: {{__e2eResult.detail}}</view>
<view class="panel-row">Greeting: {{__e2eData.greeting}}</view>
<view class="panel-row">Target: {{__e2eData.target}}</view>
`)

  return root
}

export function createNavigationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-session-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })

  writeJson(path.join(root, 'dist/app.json'), {
    pages: [
      'pages/home/index',
      'pages/detail/index',
      'pages/settings/index',
      'pages/profile/index',
    ],
    tabBar: {
      list: [
        { pagePath: 'pages/home/index', text: 'Home' },
        { pagePath: 'pages/profile/index', text: 'Profile' },
      ],
    },
  })

  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')

  writeScript(path.join(root, 'dist/pages/home/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('home:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('home:onShow')
  },
  onReady() {
    this.push('home:onReady')
  },
  onHide() {
    this.push('home:onHide')
  },
  onUnload() {
    this.push('home:onUnload')
  },
  onTabItemTap(options) {
    this.push('home:onTabItemTap:' + JSON.stringify(options))
  },
  goDetail() {
    wx.navigateTo({
      url: '../detail/index?from=home',
    })
  },
  goDetailWithCallbacks() {
    wx.navigateTo({
      url: '../detail/index?from=home-callback',
      success: () => this.push('home:navigateTo:success'),
      complete: () => this.push('home:navigateTo:complete'),
    })
  },
  goDetailLater() {
    setTimeout(() => {
      wx.navigateTo({
        url: '../detail/index?from=home-later',
      })
    }, 20)
  },
  goMissingWithCallbacks() {
    wx.navigateTo({
      url: '../missing/index',
      fail: (error) => this.push('home:navigateTo:fail:' + error.message),
      complete: () => this.push('home:navigateTo:complete'),
    })
  },
  goProfile() {
    wx.switchTab({
      url: '/pages/profile/index',
    })
  },
  goProfileWithQueryCallbacks() {
    wx.switchTab({
      url: '/pages/profile/index?from=home',
      fail: (error) => this.push('home:switchTab:fail:' + error.message),
      complete: () => this.push('home:switchTab:complete'),
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/detail/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('detail:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('detail:onShow')
  },
  onReady() {
    this.push('detail:onReady')
  },
  onHide() {
    this.push('detail:onHide')
  },
  onUnload() {
    this.push('detail:onUnload')
  },
  replaceProfile() {
    wx.redirectTo({
      url: '/pages/settings/index?from=detail',
    })
  },
  goSettings() {
    wx.navigateTo({
      url: '/pages/settings/index?from=detail-stack',
    })
  },
  backHome(delta) {
    wx.navigateBack({
      delta,
    })
  },
  relaunchProfile() {
    wx.reLaunch({
      url: '/pages/profile/index?mode=relaunch',
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/settings/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('settings:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('settings:onShow')
  },
  onReady() {
    this.push('settings:onReady')
  },
  onHide() {
    this.push('settings:onHide')
  },
  onUnload() {
    this.push('settings:onUnload')
  },
  back(delta) {
    wx.navigateBack({
      delta,
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/profile/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('profile:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('profile:onShow')
  },
  onReady() {
    this.push('profile:onReady')
  },
  onHide() {
    this.push('profile:onHide')
  },
  onUnload() {
    this.push('profile:onUnload')
  },
  onTabItemTap(options) {
    this.push('profile:onTabItemTap:' + JSON.stringify(options))
  },
})
`)

  return root
}

export function createPageEventsFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-page-events-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/events/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/events/index.js'), `
Page({
  data: {
    appBaseInfoSync: '',
    canIUseSummary: '',
    logs: [],
    menuButtonRect: '',
    callbacks: [],
    selectorCallbacks: [],
    windowInfoAsync: '',
    windowInfoSync: '',
    systemInfoAsync: '',
    systemInfoSync: '',
    scrollTop: 0,
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  runScroll(top) {
    wx.pageScrollTo({
      scrollTop: top,
      success: () => {
        this.setData({
          callbacks: [...this.data.callbacks, 'success'],
        })
      },
      complete: () => {
        this.setData({
          callbacks: [...this.data.callbacks, 'complete'],
        })
      },
    })
  },
  runScrollBySelector() {
    wx.pageScrollTo({
      selector: '#anchor-card',
      success: () => {
        this.setData({
          selectorCallbacks: [...this.data.selectorCallbacks, 'success'],
        })
      },
      complete: () => {
        this.setData({
          selectorCallbacks: [...this.data.selectorCallbacks, 'complete'],
        })
      },
    })
  },
  onPageScroll(options) {
    this.push('onPageScroll:' + JSON.stringify(options))
    this.setData({
      scrollTop: options?.scrollTop ?? 0,
    })
  },
  onPullDownRefresh() {
    this.push('onPullDownRefresh')
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    this.push('onReachBottom')
  },
  onResize(options) {
    this.push('onResize:' + JSON.stringify(options))
  },
  onRouteDone(options) {
    this.push('onRouteDone:' + JSON.stringify(options))
  },
  readSystemInfo() {
    this.setData({
      systemInfoSync: JSON.stringify(wx.getSystemInfoSync())
    })
    wx.getSystemInfo({
      success: (result) => {
        this.setData({
          systemInfoAsync: JSON.stringify(result)
        })
      }
    })
  },
  readCompatibilityInfo() {
    this.setData({
      appBaseInfoSync: JSON.stringify(wx.getAppBaseInfoSync()),
      canIUseSummary: JSON.stringify({
        getWindowInfo: wx.canIUse('getWindowInfo'),
        getWindowInfoReturn: wx.canIUse('getWindowInfo.return.windowWidth'),
        menuButtonRect: wx.canIUse('getMenuButtonBoundingClientRect'),
        nextTick: wx.canIUse('nextTick'),
        missing: wx.canIUse('shareFileMessage')
      }),
      menuButtonRect: JSON.stringify(wx.getMenuButtonBoundingClientRect()),
      windowInfoSync: JSON.stringify(wx.getWindowInfoSync())
    })
    wx.getWindowInfo({
      success: (result) => {
        this.setData({
          windowInfoAsync: JSON.stringify(result)
        })
      }
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/events/index.wxml'), `
<view>scroll: {{scrollTop}}</view>
<view id="anchor-card" style="top: 236px; height: 40px;">anchor</view>
`)

  return root
}

export function createVideoContextFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-video-context-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/video/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/video/index.js'), `
Page({
  data: {
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  playVideo() {
    this.videoContext = wx.createVideoContext('hero-video', this)
    this.videoContext.seek(12.5)
    this.videoContext.play()
    this.videoContext.pause()
    this.videoContext.requestFullScreen()
    this.videoContext.exitFullScreen()
  },
  bindPlay(event) {
    this.push('play:' + JSON.stringify(event?.detail ?? null))
  },
  bindPause(event) {
    this.push('pause:' + JSON.stringify(event?.detail ?? null))
  },
  bindFullscreenChange(event) {
    this.push('fullscreen:' + JSON.stringify(event?.detail ?? null))
  },
})
`)
  writeText(path.join(root, 'dist/pages/video/index.wxml'), `
<video
  id="hero-video"
  bindplay="bindPlay"
  bindpause="bindPause"
  bindfullscreenchange="bindFullscreenChange"
/>
`)

  return root
}

export function createComponentSelectorFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-component-selector-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/selectors/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/selectors/index.json'), {
    usingComponents: {
      'status-card': '../../components/status-card/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/selectors/index.js'), `
Page({
  data: {
    exactSnapshot: '',
    nestedSnapshot: '',
    status: 'stable',
  },
  inspectSelectors() {
    const card = this.selectComponent('status-card')
    const cards = this.selectAllComponents('status-card') ?? []
    const badge = this.selectComponent('status-card mini-badge')
    const badges = this.selectAllComponents('status-card mini-badge') ?? []
    this.setData({
      exactSnapshot: JSON.stringify({
        hasCard: !!card,
        size: cards.length,
      }),
      nestedSnapshot: JSON.stringify({
        label: badge?.properties?.label ?? '',
        size: badges.length,
      }),
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/selectors/index.wxml'), '<status-card id="status-card" status="{{status}}" /><view>{{exactSnapshot}}</view><view>{{nestedSnapshot}}</view>\n')
  writeJson(path.join(root, 'dist/components/status-card/index.json'), {
    usingComponents: {
      'mini-badge': '../mini-badge/index',
    },
  })
  writeScript(path.join(root, 'dist/components/status-card/index.js'), `
Component({
  properties: {
    status: {
      type: String,
      value: '',
    },
  },
})
`)
  writeText(path.join(root, 'dist/components/status-card/index.wxml'), '<mini-badge id="mini-badge" label="{{status}}" />\n')
  writeJson(path.join(root, 'dist/components/mini-badge/index.json'), {})
  writeScript(path.join(root, 'dist/components/mini-badge/index.js'), `
Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
  },
})
`)
  writeText(path.join(root, 'dist/components/mini-badge/index.wxml'), '<view>{{label}}</view>\n')

  return root
}

export function createIntersectionObserverFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-intersection-observer-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/observer/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/observer/index.js'), `
Page({
  data: {
    directSnapshot: '',
    scopedSnapshot: '',
  },
  inspectObserver() {
    const observer = wx.createIntersectionObserver(this, {
      thresholds: [0, 0.5, 1],
    }).relativeToViewport()
    observer.observe('#hero-card', (result) => {
      this.setData({
        directSnapshot: JSON.stringify(result),
      })
      observer.disconnect()
    })
  },
  inspectScopedObserver() {
    const observer = this.createIntersectionObserver({
      thresholds: [0, 1],
    }).relativeToViewport()
    observer.observe('#hero-card', (result) => {
      this.setData({
        scopedSnapshot: JSON.stringify(result),
      })
      observer.disconnect()
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/observer/index.wxml'), `
<view id="hero-card" style="left: 12px; top: 16px; width: 80px; height: 40px;">hero</view>
<view>{{directSnapshot}}</view>
<view>{{scopedSnapshot}}</view>
`)

  return root
}

export function createMediaQueryObserverFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-media-query-observer-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/media/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/media/index.json'), {
    usingComponents: {
      'media-probe': '../../components/media-probe/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/media/index.js'), `
Page({
  data: {
    componentMatches: [],
    pageMatches: [],
  },
  inspectPageMediaQuery() {
    const observer = this.createMediaQueryObserver()
    observer.observe({
      minWidth: 400,
      orientation: 'portrait',
    }, (result) => {
      this.setData({
        pageMatches: [...this.data.pageMatches, result.matches],
      })
    })
  },
  inspectComponentMediaQuery() {
    this.selectComponent('#media-probe')?.startObservation()
  },
  handleComponentMediaQuery(event) {
    this.setData({
      componentMatches: [...this.data.componentMatches, event?.detail?.matches ?? null],
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/media/index.wxml'), `
<media-probe id="media-probe" bind:change="handleComponentMediaQuery" />
<view>{{pageMatches}}</view>
<view>{{componentMatches}}</view>
`)
  writeJson(path.join(root, 'dist/components/media-probe/index.json'), {})
  writeScript(path.join(root, 'dist/components/media-probe/index.js'), `
Component({
  methods: {
    startObservation() {
      const observer = this.createMediaQueryObserver()
      observer.observe({
        minWidth: 400,
        orientation: 'portrait',
      }, (result) => {
        this.triggerEvent('change', result, {
          bubbles: true,
          composed: true,
        })
      })
    },
  },
})
`)
  writeText(path.join(root, 'dist/components/media-probe/index.wxml'), '<view>probe</view>\n')

  return root
}

export function createAnimationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-animation-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/animation/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/animation/index.js'), `
Page({
  data: {
    animationSnapshot: '',
    animationSecondSnapshot: '',
  },
  runAnimationLab() {
    const animation = wx.createAnimation({
      duration: 120,
      timingFunction: 'ease-in',
      transformOrigin: '0 0 0',
    })
    animation.opacity(0.4).translate(12, 24).step({
      delay: 16,
    })
    animation.rotate(45).scale(1.2).backgroundColor('#ff5500').step()
    this.setData({
      animationSnapshot: JSON.stringify(animation.export()),
      animationSecondSnapshot: JSON.stringify(animation.export()),
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/animation/index.wxml'), `
<view animation="{{animationData}}"></view>
<view>{{animationSnapshot}}</view>
<view>{{animationSecondSnapshot}}</view>
`)

  return root
}

export function createCanvasContextFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-canvas-context-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/canvas/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/canvas/index.json'), {
    usingComponents: {
      'canvas-probe': '../../components/canvas-probe/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/canvas/index.js'), `
Page({
  data: {
    canvasSnapshot: '',
    canvasQuerySnapshot: '',
    componentCanvasSnapshot: '',
    textMeasureWidth: 0,
  },
  runCanvasLab() {
    const ctx = wx.createCanvasContext('hero-canvas', this)
    ctx.setFillStyle('#ff5500')
    ctx.setGlobalAlpha(0.6)
    ctx.setLineCap('round')
    ctx.setLineDash([6, 3], 2)
    ctx.setLineJoin('bevel')
    ctx.setMiterLimit(6)
    ctx.setShadow(2, 3, 4, '#112233')
    ctx.fillRect(4, 8, 40, 24)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(18, 12)
    ctx.quadraticCurveTo(24, 4, 30, 18)
    ctx.bezierCurveTo(32, 10, 36, 16, 42, 8)
    ctx.arcTo(42, 8, 50, 18, 4)
    ctx.closePath()
    ctx.rect(2, 3, 16, 10)
    ctx.arc(10, 12, 6, 0, Math.PI, false)
    ctx.clip('evenodd')
    ctx.translate(3, 4)
    ctx.rotate(0.5)
    ctx.scale(1.2, 0.8)
    ctx.stroke()
    ctx.setFontSize(18)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    const metrics = ctx.measureText('canvas')
    ctx.fillText('canvas', 6, 20)
    ctx.strokeText('canvas', 6, 20)
    ctx.restore()
    ctx.draw(false, () => {
      this.setData({
        canvasSnapshot: JSON.stringify(ctx.__getSnapshot()),
        textMeasureWidth: metrics.width,
      })
    })
  },
  inspectCanvasQuery() {
    wx.createSelectorQuery()
      .select('canvas')
      .fields({
        context: true,
        node: true,
      }, (result) => {
        result.context.setFillStyle('#00aa55')
        result.context.fillRect(2, 4, 12, 6)
        result.context.draw(false, () => {
          this.setData({
            canvasQuerySnapshot: JSON.stringify({
              node: result.node,
              snapshot: result.context.__getSnapshot(),
            }),
          })
        })
      })
      .exec()
  },
  runComponentCanvasLab() {
    this.selectComponent('#canvas-probe')?.paint()
  },
  handleCanvasPaint(event) {
    this.setData({
      componentCanvasSnapshot: JSON.stringify(event?.detail ?? null)
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/canvas/index.wxml'), `
<canvas canvas-id="hero-canvas"></canvas>
<canvas-probe id="canvas-probe" bind:paint="handleCanvasPaint" />
<view>{{canvasSnapshot}}</view>
<view>{{canvasQuerySnapshot}}</view>
<view>{{componentCanvasSnapshot}}</view>
<view>{{textMeasureWidth}}</view>
`)
  writeJson(path.join(root, 'dist/components/canvas-probe/index.json'), {})
  writeScript(path.join(root, 'dist/components/canvas-probe/index.js'), `
Component({
  methods: {
    paint() {
      const ctx = wx.createCanvasContext('inner-canvas', this)
      ctx.setStrokeStyle('#0055ff')
      ctx.setGlobalAlpha(0.8)
      ctx.setLineCap('square')
      ctx.setLineDash([4, 2])
      ctx.setShadow(1, 1, 2, '#445566')
      ctx.setLineWidth(3)
      ctx.save()
      ctx.translate(2, 3)
      ctx.strokeRect(10, 12, 30, 18)
      ctx.restore()
      ctx.draw(false, () => {
        this.triggerEvent('paint', ctx.__getSnapshot(), {
          bubbles: true,
          composed: true,
        })
      })
    },
  },
})
`)
  writeText(path.join(root, 'dist/components/canvas-probe/index.wxml'), '<canvas canvas-id="inner-canvas"></canvas>\n')

  return root
}

export function createAppLifecycleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-app-lifecycle-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/home/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), `
App({
  globalData: {
    enterOptions: null,
    launchOptions: null,
    logs: [],
    ready: true,
  },
  captureEnterOptions() {
    this.globalData.enterOptions = wx.getEnterOptionsSync()
  },
  captureLaunchOptions() {
    this.globalData.launchOptions = wx.getLaunchOptionsSync()
  },
  push(message) {
    this.globalData.logs.push(message)
  },
  onLaunch(options) {
    this.push('onLaunch:' + JSON.stringify(options))
  },
  onShow(options) {
    this.push('onShow:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.push('onPageNotFound:' + JSON.stringify(options))
  },
})
`)
  writeScript(path.join(root, 'dist/pages/home/index.js'), `
Page({
  data: {
    ok: true,
  },
})
`)

  return root
}

export function createSelectorQueryFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-selector-query-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/index/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    compoundSelectorResult: null,
    selectorQueryResult: null,
    viewportResult: null,
  },
  runCompoundSelectorQuery() {
    wx.createSelectorQuery()
      .select('view.panel[data-role="hero"]')
      .fields({
        dataset: true,
        id: true,
        properties: ['class']
      }, (result) => {
        this.setData({
          compoundSelectorResult: result
        })
      })
      .exec()
  },
  runSelectorQuery() {
    wx.createSelectorQuery()
      .select('#card')
      .fields({
        id: true,
        dataset: true,
        rect: true,
        size: true,
        properties: ['class']
      }, (result) => {
        this.setData({
          selectorQueryResult: result
        })
      })
      .exec()
  },
  runViewportQuery() {
    wx.pageScrollTo({
      scrollTop: 64
    })
    wx.createSelectorQuery()
      .selectViewport()
      .scrollOffset((result) => {
        this.setData({
          viewportResult: result
        })
      })
      .exec()
  }
})
`)
  writeText(path.join(root, 'dist/pages/index/index.wxml'), `
<view
  id="card"
  class="panel primary"
  data-role="hero"
  data-phase="ready"
  style="left: 12px; top: 24px; width: 120px; height: 48px;"
>Card</view>
`)

  return root
}

export function createComponentFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-component-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/lab/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/lab/index.json'), {
    usingComponents: {
      'status-card': '../../components/status-card/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/lab/index.js'), `
Page({
  data: {
    count: 2,
    eventSnapshot: '',
    formSnapshot: '',
    metaSummary: '',
    log: [],
    multiRectSummary: '',
    scopedRect: null,
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
  },
  inspectScopedQuery() {
    const card = this.selectComponent('#status-card')
    wx.createSelectorQuery()
      .in(card)
      .select('.card-shell')
      .boundingClientRect((result) => {
        this.setData({
          scopedRect: result
        })
      })
      .exec()
  },
  inspectScopedSelectAll() {
    const card = this.selectComponent('#status-card')
    wx.createSelectorQuery()
      .in(card)
      .selectAll('.multi-item')
      .fields({
        dataset: true,
        id: true
      }, (result) => {
        this.setData({
          multiRectSummary: JSON.stringify(result)
        })
      })
      .exec()
  },
  inspectMetaQuery() {
    const card = this.selectComponent('#status-card')
    wx.createSelectorQuery()
      .in(card)
      .select('#card-trigger')
      .fields({
        context: true,
        mark: true,
        node: true
      }, (result) => {
        this.setData({
          metaSummary: JSON.stringify(result)
        })
      })
      .exec()
  },
  inspectForm() {
    const card = this.selectComponent('#status-card')
    this.setData({
      formSnapshot: JSON.stringify(card?.data?.formState ?? null)
    })
  },
  onPulse(event) {
    this.setData({
      eventSnapshot: JSON.stringify({
        currentTargetDataset: event?.currentTarget?.dataset ?? {},
        currentTargetId: event?.currentTarget?.id ?? '',
        mark: event?.mark ?? null,
        targetDataset: event?.target?.dataset ?? {},
        targetId: event?.target?.id ?? '',
      }),
      log: [...this.data.log, event?.detail?.source ?? 'none']
    })
  }
})
`)
  writeText(path.join(root, 'dist/pages/lab/index.wxml'), `
<status-card id="status-card" class="primary-card" data-role="main" count="{{count}}" bind:pulse="onPulse" />
<view>{{snapshot}}</view>
<view>{{eventSnapshot}}</view>
<view>{{log.0}}</view>
`)
  writeJson(path.join(root, 'dist/components/status-card/index.json'), {})
  writeScript(path.join(root, 'dist/components/status-card/index.js'), `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    }
  },
  data: {
    formState: {
      blur: '',
      change: '',
      input: ''
    }
  },
  methods: {
    onInnerInput(event) {
      this.setData({
        'formState.input': event?.detail?.value ?? ''
      })
    },
    onInnerChange(event) {
      this.setData({
        'formState.change': event?.detail?.value ?? ''
      })
    },
    onInnerBlur(event) {
      this.setData({
        'formState.blur': event?.detail?.value ?? ''
      })
    },
    pulse() {
      this.triggerEvent('pulse', {
        source: 'status-card'
      })
    }
  }
})
`)
  writeText(path.join(root, 'dist/components/status-card/index.wxml'), `
<view id="card-trigger" class="card-shell" mark:source="component-card" bindtap="pulse">count: {{count}}</view>
<input id="card-input" bindinput="onInnerInput" bindchange="onInnerChange" bindblur="onInnerBlur" value="{{formState.input}}" />
<view id="multi-a" class="multi-item" data-kind="alpha"></view>
<view id="multi-b" class="multi-item" data-kind="beta"></view>
`)

  return root
}

export function createComponentLifecycleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-component-lifecycle-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/a/index', 'pages/b/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/a/index.json'), {
    usingComponents: {
      'status-card': '../../components/status-card/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/a/index.js'), `
Page({
  openB() {
    wx.navigateTo({
      url: '/pages/b/index'
    })
  }
})
`)
  writeText(path.join(root, 'dist/pages/a/index.wxml'), '<status-card id="status-card" mode="alpha" />')
  writeScript(path.join(root, 'dist/pages/b/index.js'), 'Page({})\n')
  writeText(path.join(root, 'dist/pages/b/index.wxml'), '<view>b</view>')
  writeJson(path.join(root, 'dist/components/status-card/index.json'), {})
  writeScript(path.join(root, 'dist/components/status-card/index.js'), `
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
  lifetimes: {
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
`)
  writeText(path.join(root, 'dist/components/status-card/index.wxml'), '<view>{{mode}}</view><view>{{lifecycleLog.0}}</view><view>{{lifecycleLog.1}}</view><view>{{lifecycleLog.2}}</view><view>{{lifecycleLog.3}}</view><view>{{lifecycleLog.4}}</view><view>{{lifecycleLog.5}}</view>')

  return root
}

export function createNestedComponentFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-nested-component-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/lab/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/lab/index.json'), {
    usingComponents: {
      'status-card': '../../components/status-card/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/lab/index.js'), 'Page({})\n')
  writeText(path.join(root, 'dist/pages/lab/index.wxml'), '<status-card id="status-card" status="stable" />')
  writeJson(path.join(root, 'dist/components/status-card/index.json'), {
    usingComponents: {
      'mini-badge': '../mini-badge/index',
    },
  })
  writeScript(path.join(root, 'dist/components/status-card/index.js'), 'Component({ properties: { status: String } })\n')
  writeText(path.join(root, 'dist/components/status-card/index.wxml'), '<mini-badge id="mini-badge" label="{{status}}" />')
  writeJson(path.join(root, 'dist/components/mini-badge/index.json'), {})
  writeScript(path.join(root, 'dist/components/mini-badge/index.js'), `
Component({
  properties: {
    label: String
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
`)
  writeText(path.join(root, 'dist/components/mini-badge/index.wxml'), '<view id="mini-badge-inner">{{label}}</view><view>{{readyState}}</view>')

  return root
}

export function createAsyncComponentFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-async-component-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/lab/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeJson(path.join(root, 'dist/pages/lab/index.json'), {
    usingComponents: {
      'status-card': '../../components/status-card/index',
    },
  })
  writeScript(path.join(root, 'dist/pages/lab/index.js'), `
Page({
  data: {
    ready: false
  },
  onLoad() {
    setTimeout(() => {
      this.setData({
        ready: true
      })
    }, 20)
  }
})
`)
  writeText(path.join(root, 'dist/pages/lab/index.wxml'), '<status-card wx:if="{{ready}}" id="status-card" /><status-card wx:if="{{ready}}" class="secondary-card" />')
  writeJson(path.join(root, 'dist/components/status-card/index.json'), {})
  writeScript(path.join(root, 'dist/components/status-card/index.js'), 'Component({})\n')
  writeText(path.join(root, 'dist/components/status-card/index.wxml'), '<view>async-card</view>')

  return root
}
