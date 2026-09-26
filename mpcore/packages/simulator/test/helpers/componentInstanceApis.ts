function componentSource(label: 'parent' | 'child', queryDuringAttached: boolean) {
  const key = label === 'parent' ? './child' : './parent'
  const type = label === 'parent' ? 'descendant' : 'ancestor'
  return `
function record(instance, event) {
  getApp().trace.push('${label}:' + event + ':' + (instance.getRelationNodes('${key}').map(node => node.data.label).join(',') || 'none'))
}
Component({
  data: { label: '${label}', queryResult: 'pending' },
  relations: { '${key}': {
    type: '${type}',
    linked() { record(this, 'linked') },
    unlinked() { record(this, 'unlinked') },
  } },
  detached() { record(this, 'detached') },
  lifetimes: {
    attached() {
      record(this, 'attached')
      ${queryDuringAttached ? 'this.createSelectorQuery().select(\'#scope-node\').fields({ dataset: true }).exec()' : ''}
    },
    ready() {
      record(this, 'ready')
      this.createSelectorQuery().select('#scope-node').fields({ dataset: true }, result => {
        this.setData({ queryResult: result && result.dataset.scope || 'missing' })
      }).exec()
    },
  },
})`
}

export function createComponentInstanceApiFiles(queryDuringAttached = false): Array<[string, string]> {
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/empty/index'] })],
    ['app.js', 'App({ trace: [] })'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { 'relation-parent': '/components/parent', 'relation-child': '/components/child' } })],
    ['pages/index/index.js', `Page({ data: { showChild: true, trace: '' },
    onLoad() { getApp().trace.push('page:onLoad') },
    snapshot() { this.setData({ trace: getApp().trace.join('\\n') }); return getApp().trace.slice() },
    removeChild() { this.setData({ showChild: false }) },
    restoreChild() { this.setData({ showChild: true }) },
  })`],
    ['pages/index/index.wxml', '<view id="scope-node" data-scope="page"><relation-parent id="parent"><view><relation-child wx:if="{{showChild}}" id="child" /></view></relation-parent><text id="relation-trace">{{trace}}</text></view>'],
    ['pages/empty/index.js', 'Page({})'],
    ['pages/empty/index.wxml', '<view>empty</view>'],
    ['components/parent.json', JSON.stringify({ component: true })],
    ['components/parent.js', componentSource('parent', queryDuringAttached)],
    ['components/parent.wxml', '<view><text id="scope-node" data-scope="parent">parent scope</text><text id="parent-query">{{queryResult}}</text><slot /></view>'],
    ['components/child.json', JSON.stringify({ component: true })],
    ['components/child.js', componentSource('child', queryDuringAttached)],
    ['components/child.wxml', '<view><text id="scope-node" data-scope="child">child scope</text><text id="child-query">{{queryResult}}</text></view>'],
  ]
}

export const componentInstanceApiFiles = createComponentInstanceApiFiles()
