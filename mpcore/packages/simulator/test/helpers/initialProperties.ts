export const initialPropertiesFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'], subPackages: [] })],
  ['app.js', 'App({ trace: [], sequence: 0 })'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { probe: '/components/probe' } })],
  ['pages/index/index.js', `Page({
    data: { a: 'incoming-a', b: ['item', { label: 'alpha' }, 'index', 0], events: [], report: '', revision: 'initial' },
    capture() {
      var events = JSON.parse(JSON.stringify(getApp().trace));
      this.setData({ events: events, report: JSON.stringify(events) });
    },
    onReady() { this.capture(); },
    advance() {
      this.setData({ a: 'updated-a', b: ['item', { label: 'beta' }, 'index', 1], revision: 'updated' }, () => this.capture());
    }
  })`],
  ['pages/index/index.wxml', `
    <probe id="forward" a="{{a}}" b="{{b}}" />
    <probe id="reverse" b="{{b}}" a="{{a}}" />
    <text class="probe-revision">{{revision}}</text>
    <text class="probe-summary">{{report}}</text>
  `],
  ['components/probe.json', JSON.stringify({ component: true })],
  ['components/probe.js', `Component({
    properties: {
      a: { type: String, value: 'default-a', observer(next, previous) { this.record('property:a', next, previous); } },
      b: { type: null, value: null, observer(next, previous) { this.record('property:b', next, previous); } }
    },
    observers: {
      'a,b': function () { this.record('data:a,b'); }
    },
    lifetimes: {
      created() { this.probeSequence = getApp().sequence++; this.record('created'); },
      attached() { this.record('attached'); }
    },
    methods: {
      record(phase, next, previous) {
        getApp().trace.push(JSON.parse(JSON.stringify({
          sequence: this.probeSequence,
          phase: phase,
          dataA: this.data.a,
          dataB: this.data.b,
          propertyA: this.properties.a,
          propertyB: this.properties.b,
          next: next,
          previous: previous
        })));
      }
    }
  })`],
  ['components/probe.wxml', '<text class="component-state">{{a}}/{{b[3]}}</text>'],
]
