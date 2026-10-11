export function createAttachmentReentryFiles(scenario: 'clamp' | 'detach'): Array<[string, string]> {
  return [
    ['project.config.json', '{"miniprogramRoot":"./"}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({ trace: [] })'],
    ['pages/index/index.json', '{"usingComponents":{"child":"/components/child","a":"/components/a","b":"/components/b"}}'],
    ['pages/index/index.js', scenario === 'clamp'
      ? `Component({
      data: { value: 0 },
      lifetimes: { attached() {
        getApp().trace.push(['owner:attached']);
        this.setData({ value: 200 });
        getApp().trace.push(['owner:after']);
      } },
      methods: { readTrace() { return getApp().trace; } }
    })`
      : `Page({
      data: { showA: true, showB: false },
      trigger() { this.setData({ showB: true }); },
      readTrace() { return getApp().trace; }
    })`],
    ['pages/index/index.wxml', scenario === 'clamp' ? '<child value="{{value}}" />' : '<a wx:if="{{showA}}" /><b wx:if="{{showB}}" />'],
    ['components/child.json', '{"component":true,"usingComponents":{"leaf":"/components/leaf"}}'],
    ['components/child.js', `Component({
      properties: { value: { type: Number, value: 0, observer(value) {
        getApp().trace.push(['child:property', value]);
        if (value > 100) {
          this.setData({ value: 100 });
          getApp().trace.push(['child:after-clamp', this.properties.value]);
        }
      } } },
      lifetimes: { attached() { getApp().trace.push(['child:attached', this.properties.value]); } }
    })`],
    ['components/child.wxml', '<leaf value="{{value}}" />'],
    ['components/leaf.json', '{"component":true}'],
    ['components/leaf.js', `Component({
      properties: { value: { type: Number, value: 0, observer(value) { getApp().trace.push(['leaf:property', value]); } } },
      lifetimes: { attached() { getApp().trace.push(['leaf:attached', this.properties.value]); } }
    })`],
    ['components/leaf.wxml', '<text id="clamped">{{value}}</text>'],
    ['components/a.json', '{"component":true}'],
    ['components/a.js', `Component({ lifetimes: {
      attached() { getApp().trace.push(['a:attached']); },
      detached() {
        getApp().trace.push(['a:detached']);
        this.setData({ cleaned: true });
        getApp().trace.push(['a:after-cleanup']);
      }
    } })`],
    ['components/a.wxml', '<text id="removed">A</text>'],
    ['components/b.json', '{"component":true}'],
    ['components/b.js', `Component({ lifetimes: { attached() {
      getApp().trace.push(['b:attached']);
      const pages = getCurrentPages();
      pages[pages.length - 1].setData({ showA: false });
      getApp().trace.push(['b:after']);
    } } })`],
    ['components/b.wxml', '<text id="retained">B</text>'],
  ]
}

export const attachmentClampTrace = [
  ['owner:attached'],
  ['leaf:property', 200],
  ['child:property', 200],
  ['leaf:property', 100],
  ['child:property', 100],
  ['child:after-clamp', 100],
  ['owner:after'],
  ['child:attached', 100],
  ['leaf:attached', 100],
]

export const attachmentDetachTrace = [
  ['a:attached'],
  ['b:attached'],
  ['b:after'],
  ['a:detached'],
  ['a:after-cleanup'],
]

export function createAttachmentOwnerWriteFiles(scenario: 'existing' | 'inserted' | 'loop' | 'unprojected'): Array<[string, string]> {
  const children = '<first value="{{value}}" /><second value="{{value}}" />'
  const template = scenario === 'inserted'
    ? `<block wx:if="{{visible}}">${children}</block>`
    : scenario === 'loop'
      ? '<block wx:for="{{[0, 1]}}" wx:key="*this"><first wx:if="{{item === 0}}" value="{{value}}" /><second wx:else value="{{value}}" /></block>'
      : scenario === 'unprojected' ? `<shell>${children}</shell>` : children
  return [
    ['project.config.json', '{"miniprogramRoot":"./"}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({ after: null, delivered: [], attached: { first: [], second: [] } })'],
    ['pages/index/index.json', '{"usingComponents":{"owner":"/components/owner"}}'],
    ['pages/index/index.js', `Page({ snapshot() {
      const app = getApp();
      return { after: app.after, delivered: app.delivered, attached: app.attached };
    } })`],
    ['pages/index/index.wxml', '<owner />'],
    ['components/owner.json', '{"component":true,"usingComponents":{"first":"/components/first","second":"/components/second","shell":"/components/shell"}}'],
    ['components/owner.js', `Component({
      data: { value: 0, visible: false },
      lifetimes: { attached() {
        this.setData({ value: 1, visible: true });
        getApp().after = [this.data.value, getApp().second.properties.value];
      } }
    })`],
    ['components/owner.wxml', template],
    ['components/first.json', '{"component":true}'],
    ['components/first.js', `Component({
      properties: { value: { type: Number, value: 0, observer(value) {
        if (value === 1) this.selectOwnerComponent().setData({ value: 2 });
      } } },
      lifetimes: { attached() { getApp().attached.first.push(this.properties.value); } }
    })`],
    ['components/first.wxml', '<text>{{value}}</text>'],
    ['components/second.json', '{"component":true}'],
    ['components/second.js', `Component({
      properties: { value: { type: Number, value: 0, observer(value) { getApp().delivered.push(value); } } },
      lifetimes: {
        created() { getApp().second = this; },
        attached() { getApp().attached.second.push(this.properties.value); }
      }
    })`],
    ['components/second.wxml', '<text id="latest-owner-value">{{value}}</text>'],
    ['components/shell.json', '{"component":true}'],
    ['components/shell.js', 'Component({})'],
    ['components/shell.wxml', '<view />'],
  ]
}

export function createAttachmentCreatedWriteFiles(writer: 'middle' | 'leaf'): Array<[string, string]> {
  return [
    ['project.config.json', '{"miniprogramRoot":"./"}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({ leaves: [], created: [], observed: [], attached: { first: [], second: [] } })'],
    ['pages/index/index.json', '{"usingComponents":{"middle":"/components/middle"}}'],
    ['pages/index/index.js', `Component({
      data: { visible: false, model: null },
      lifetimes: { attached() { this.setData({ visible: true, model: { label: 'bound' } }); } },
      methods: { snapshot() {
        const app = getApp();
        return { created: app.created, observed: app.observed, attached: app.attached };
      } }
    })`],
    ['pages/index/index.wxml', '<middle wx:if="{{visible}}" model="{{model}}" />'],
    ['components/middle.json', '{"component":true,"usingComponents":{"leaf":"/components/leaf"}}'],
    ['components/middle.js', `Component({
      properties: { model: { type: Object, value: null, observer() {
        getApp().observed.push(getApp().leaves.map(leaf => [leaf.properties.name, leaf.properties.model.label]));
      } } },
      data: { initialized: false },
      lifetimes: { created() {
        getApp().created.push(getApp().leaves.map(leaf => leaf.properties.name));
        ${writer === 'middle' ? 'this.setData({ initialized: true });' : ''}
      } }
    })`],
    ['components/middle.wxml', '<leaf name="first" model="{{model}}" /><leaf name="second" model="{{model}}" />'],
    ['components/leaf.json', '{"component":true}'],
    ['components/leaf.js', `Component({
      properties: { name: String, model: { type: Object, value: null } },
      data: { initialized: false },
      lifetimes: {
        created() {
          getApp().leaves.push(this);
          ${writer === 'leaf' ? 'this.setData({ initialized: true });' : ''}
        },
        attached() { getApp().attached[this.properties.name].push(this.properties.model.label); }
      }
    })`],
    ['components/leaf.wxml', '<text id="created-write-{{name}}">{{model.label}}</text>'],
  ]
}

export function createAttachmentBatchFiles(count: number): Array<[string, string]> {
  const rows = Array.from({ length: count }, (_, index) => index)
  return [
    ['project.config.json', '{"miniprogramRoot":"./"}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({ trace: [] })'],
    ['pages/index/index.json', '{"usingComponents":{"leaf":"/components/leaf"}}'],
    ['pages/index/index.js', `Page({ data: { rows: ${JSON.stringify(rows)} }, snapshot() { return getApp().trace; } })`],
    ['pages/index/index.wxml', '<leaf wx:for="{{rows}}" wx:key="*this" row="{{item}}" />'],
    ['components/leaf.json', '{"component":true}'],
    ['components/leaf.js', `Component({
      properties: { row: Number }, data: { initialized: false },
      lifetimes: {
        attached() {
          getApp().trace.push(['attached', this.properties.row]);
          this.setData({ initialized: true });
          getApp().trace.push(['after', this.properties.row, this.data.initialized]);
        },
        ready() { getApp().trace.push(['ready', this.properties.row]); }
      }
    })`],
    ['components/leaf.wxml', '<text id="batch-{{row}}">{{initialized}}</text>'],
  ]
}
