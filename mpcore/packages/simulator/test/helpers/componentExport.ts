export const componentExportFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { exported: '/components/exported', plain: '/components/plain', parent: '/components/parent' } })],
  ['pages/index/index.wxml', '<exported id="exported" class="exported" /><plain id="plain" /><parent id="parent" /><text id="result">{{label}}</text>'],
  ['pages/index/index.js', `Page({ data: { label: '' }, inspect() {
    const exported = this.selectComponent('#exported');
    const parent = this.selectComponent('#parent');
    this.setData({ label: exported.label });
    return { exported, all: this.selectAllComponents('.exported'), nested: parent.inspect(), plain: typeof this.selectComponent('#plain').setData, missing: this.selectComponent('#missing') };
  } })`],
  ['components/exported.json', JSON.stringify({ component: true })],
  ['components/exported.wxml', '<text>{{label}}</text>'],
  ['components/exported.js', `Component({
    behaviors: [Behavior({ behaviors: ['wx://component-export'] })],
    data: { label: 'exported' },
    export() { return { label: this.data.label }; }
  })`],
  ['components/plain.json', JSON.stringify({ component: true })],
  ['components/plain.wxml', '<text>plain</text>'],
  ['components/plain.js', 'Component({ export() { return { label: "must not export without behavior" }; } })'],
  ['components/parent.json', JSON.stringify({ component: true, usingComponents: { exported: '/components/exported' } })],
  ['components/parent.wxml', '<exported id="child" />'],
  ['components/parent.js', `Component({ methods: { inspect() { return { one: this.selectComponent('#child'), all: this.selectAllComponents('#child') }; } } })`],
]

export const componentExportSnapshot = {
  exported: { label: 'exported' },
  all: [{ label: 'exported' }],
  nested: { one: { label: 'exported' }, all: [{ label: 'exported' }] },
  plain: 'function',
  missing: null,
}
