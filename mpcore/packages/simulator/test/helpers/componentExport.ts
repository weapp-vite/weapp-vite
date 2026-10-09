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

export function createOwnerComponentExportFiles(behavior: 'direct' | 'nested'): Array<[string, string]> {
  const exportBehavior = behavior === 'direct'
    ? '\'wx://component-export\''
    : 'Behavior({ behaviors: [\'wx://component-export\'] })'
  return [
    ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { exported: '/components/exported', plain: '/components/plain' } })],
    ['pages/index/index.js', 'Page({})'],
    ['pages/index/index.wxml', '<exported id="exported" /><plain id="plain" />'],
    ['components/exported.json', JSON.stringify({ component: true, usingComponents: { probe: '/components/probe' } })],
    ['components/exported.wxml', '<text id="owner-count">{{count}}</text><probe id="exported-probe" />'],
    ['components/exported.js', `Component({
      behaviors: [${exportBehavior}],
      data: { count: 0, secret: 'private owner state' },
      methods: {
        privateIncrement() { this.setData({ count: this.data.count + 1 }); }
      },
      export() {
        return { label: 'filtered-owner', increment: () => this.privateIncrement() };
      }
    })`],
    ['components/plain.json', JSON.stringify({ component: true, usingComponents: { probe: '/components/probe' } })],
    ['components/plain.wxml', '<probe id="plain-probe" />'],
    ['components/plain.js', `Component({
      data: { label: 'ordinary-owner' },
      export() { throw new Error('export must not run without the export behavior'); }
    })`],
    ['components/probe.json', JSON.stringify({ component: true })],
    ['components/probe.wxml', '<text class="owner-label">{{label}}</text><text class="owner-keys">{{keys}}</text><text class="owner-private">{{privateVisible}}</text><button bindtap="incrementOwner">increment owner</button>'],
    ['components/probe.js', `Component({
      data: { label: '', keys: '', privateVisible: '' },
      methods: {
        getOwner() { return this.selectOwnerComponent(); },
        inspectOwner() {
          const owner = this.selectOwnerComponent();
          this.setData({
            label: owner.label,
            keys: Object.keys(owner).sort().join(','),
            privateVisible: String('privateIncrement' in owner || 'setData' in owner || 'data' in owner),
          });
          return owner;
        },
        incrementOwner() { this.selectOwnerComponent().increment(); }
      }
    })`],
  ]
}
