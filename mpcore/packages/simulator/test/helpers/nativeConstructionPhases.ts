export function createNativeConstructionFiles(open: boolean): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({ events: [] })'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { host: '/components/host', leaf: '/components/leaf' } })],
    ['pages/index/index.wxml', '<host id="host" value="passed" bind:probe="record"><leaf label="slotted" bind:probe="record" /></host>'],
    ['pages/index/index.js', `Page({
      onLoad() { getApp().events.push({ at: 'page.load' }) },
      onReady() { getApp().events.push({ at: 'page.ready' }) },
      record(event) {
        const host = this.selectComponent('#host');
        getApp().events.push({ at: 'page.received', detail: event.detail, hostPresent: !!host, hostCreated: !!(host && host.wasCreated) });
      },
      readEvents() { return getApp().events }
    })`],
    ['components/host.json', JSON.stringify({ component: true, usingComponents: { leaf: '/components/leaf' } })],
    ['components/host.wxml', '<leaf wx:if="{{value === \'default\'}}" id="internal" label="default" bind:probe="capture" /><leaf wx:else id="internal" label="passed" bind:probe="capture" /><view wx:if="{{open}}"><slot /></view>'],
    ['components/host.js', `Component({
      data: { open: ${open} },
      properties: { value: { type: String, value: 'default', observer(value) {
        getApp().events.push({ at: 'host.observer.begin', value, created: !!this.wasCreated });
        this.triggerEvent('probe', { at: 'host.observer', value });
        getApp().events.push({ at: 'host.observer.end', value });
      } } },
      lifetimes: {
        created() {
          this.wasCreated = true;
          const child = this.selectComponent('#internal');
          getApp().events.push({ at: 'host.created', value: this.data.value, childPresent: !!child, childLabel: child?.data.label });
          if (child) child.emit();
          this.triggerEvent('probe', { at: 'host.created' });
          getApp().events.push({ at: 'host.created.end' });
        },
        attached() { getApp().events.push({ at: 'host.attached', value: this.data.value }) },
        ready() { getApp().events.push({ at: 'host.ready', value: this.data.value }) }
      },
      methods: { capture(event) {
        const child = this.selectComponent('#internal');
        getApp().events.push({ at: 'host.received', detail: event.detail, childPresent: !!child, childLabel: child?.data.label });
      } }
    })`],
    ['components/leaf.json', JSON.stringify({ component: true })],
    ['components/leaf.wxml', '<view>{{label}}</view>'],
    ['components/leaf.js', `Component({
      methods: { emit() { this.triggerEvent('probe', { at: 'invoked-inside-host-created', label: this.data.label }) } },
      properties: { label: { type: String, value: 'initial', observer(label) {
        getApp().events.push({ at: 'leaf.observer.begin', label, created: !!this.wasCreated });
        this.triggerEvent('probe', { at: 'leaf.observer', label });
        getApp().events.push({ at: 'leaf.observer.end', label });
      } } },
      lifetimes: {
        created() { this.wasCreated = true; getApp().events.push({ at: 'leaf.created', label: this.data.label }); this.triggerEvent('probe', { at: 'leaf.created', label: this.data.label }) },
        attached() { getApp().events.push({ at: 'leaf.attached', label: this.data.label }); this.triggerEvent('probe', { at: 'leaf.attached', label: this.data.label }) },
        ready() { getApp().events.push({ at: 'leaf.ready', label: this.data.label }) },
        detached() { getApp().events.push({ at: 'leaf.detached', label: this.data.label }) }
      }
    })`],
  ]
}

// DevTools 2.02.2608080 / 基础库 3.17.2：出口初始开关及绑定属性次序均不改变此原生轨迹。
export const nativeConstructionTrace = [
  { at: 'leaf.created', label: 'initial' },
  { at: 'leaf.observer.begin', label: 'default', created: true },
  { at: 'leaf.observer.end', label: 'default' },
  { at: 'host.created', value: 'default', childPresent: true, childLabel: 'default' },
  { at: 'host.received', detail: { at: 'invoked-inside-host-created', label: 'default' }, childPresent: true, childLabel: 'default' },
  { at: 'host.created.end' },
  { at: 'leaf.created', label: 'initial' },
  { at: 'leaf.observer.begin', label: 'passed', created: true },
  { at: 'host.received', detail: { at: 'leaf.observer', label: 'passed' }, childPresent: true, childLabel: 'default' },
  { at: 'leaf.observer.end', label: 'passed' },
  { at: 'host.observer.begin', value: 'passed', created: true },
  { at: 'host.observer.end', value: 'passed' },
  { at: 'leaf.created', label: 'initial' },
  { at: 'leaf.observer.begin', label: 'slotted', created: true },
  { at: 'leaf.observer.end', label: 'slotted' },
  { at: 'host.attached', value: 'passed' },
  { at: 'leaf.attached', label: 'passed' },
  { at: 'host.received', detail: { at: 'leaf.attached', label: 'passed' }, childPresent: true, childLabel: 'passed' },
  { at: 'leaf.attached', label: 'slotted' },
  { at: 'page.received', detail: { at: 'leaf.attached', label: 'slotted' }, hostPresent: true, hostCreated: true },
  { at: 'page.load' },
  { at: 'leaf.ready', label: 'default' },
  { at: 'host.ready', value: 'passed' },
  { at: 'leaf.ready', label: 'passed' },
  { at: 'leaf.ready', label: 'slotted' },
  { at: 'page.ready' },
]
