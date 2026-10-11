const appFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ events: [] })'],
]

export function createHiddenForwardingFiles(named: boolean): Array<[string, string]> {
  const name = named ? ' name="header"' : ''
  const slot = named ? ' slot="header"' : ''
  return [
    ...appFiles,
    ['pages/index/index.json', JSON.stringify({ usingComponents: { outer: '/components/outer', leaf: '/components/leaf' } })],
    ['pages/index/index.js', 'Page({ data: { open: false }, readEvents() { return getApp().events } })'],
    ['pages/index/index.wxml', `<outer open="{{open}}"><leaf${slot} /></outer>`],
    ['components/outer.json', JSON.stringify({ component: true, usingComponents: { shell: '/components/shell', inner: '/components/inner' } })],
    ['components/outer.js', 'Component({ options: { multipleSlots: true }, properties: { open: Boolean } })'],
    ['components/outer.wxml', `<shell open="{{open}}"><inner><slot${name}${slot} /></inner></shell>`],
    ['components/shell.json', JSON.stringify({ component: true })],
    ['components/shell.js', 'Component({ properties: { open: Boolean } })'],
    ['components/shell.wxml', '<view wx:if="{{open}}"><slot /></view>'],
    ['components/inner.json', JSON.stringify({ component: true })],
    ['components/inner.js', `Component({
      options: { multipleSlots: true },
      lifetimes: { attached() { this.initialized = true; getApp().events.push('inner:attached') } },
      methods: { provide(event) { event.detail.context = { owner: 'inner', ready: this.initialized === true } } }
    })`],
    ['components/inner.wxml', `<slot${name} bind:context="provide" />`],
    ['components/leaf.json', JSON.stringify({ component: true })],
    ['components/leaf.js', `Component({ lifetimes: { attached() {
      const detail = { context: null };
      this.triggerEvent('context', detail, { bubbles: true, composed: true });
      getApp().events.push('leaf:' + (detail.context ? detail.context.owner + ':' + detail.context.ready : 'missing'));
    } } })`],
    ['components/leaf.wxml', '<view>leaf</view>'],
  ]
}

export const hiddenCreationFiles: Array<[string, string]> = [
  ...appFiles,
  ['pages/index/index.json', JSON.stringify({ usingComponents: { host: '/components/host', leaf: '/components/leaf' } })],
  ['pages/index/index.js', `Page({
    onEarly() { this.selectComponent('#host'); getApp().events.push('selection-returned') },
    readEvents() { return getApp().events }
  })`],
  ['pages/index/index.wxml', '<host id="host"><leaf bind:early="onEarly" /></host>'],
  ['components/host.json', JSON.stringify({ component: true })],
  ['components/host.js', `Component({
    data: { open: false },
    lifetimes: {
      created() { this.initialized = true; getApp().events.push('host:created') },
      attached() { getApp().events.push('host:attached:' + (this.initialized === true)) }
    }
  })`],
  ['components/host.wxml', '<view wx:if="{{open}}"><slot /></view>'],
  ['components/leaf.json', JSON.stringify({ component: true })],
  ['components/leaf.js', `Component({ lifetimes: {
    created() { this.triggerEvent('early'); getApp().events.push('leaf:created-end') },
    attached() { getApp().events.push('leaf:attached') }
  } })`],
  ['components/leaf.wxml', '<view>leaf</view>'],
]
