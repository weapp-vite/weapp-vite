export const recursivePropsFiles: Array<[string, string]> = [
  ['components/editor.json', '{"component":true}'],
  ['components/editor.js', `Component({ properties: { node: Object }, methods: {
    input(event) { this.triggerEvent('edit', { id: this.properties.node.id, value: event.detail.value }) },
  } })`],
  ['components/editor.wxml', '<input id="leaf-input" value="{{node.text}}" bindinput="input"/>'],
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.json', '{"usingComponents":{"tree-node":"/components/node","leaf-editor":"/components/editor"}}'],
  ['pages/index/index.js', `Page({
    data: { tree: { id: 'root', children: [{ id: 'leaf', text: 'initial', children: [] }] }, lastInput: '' },
    update() { this.setData({ 'tree.children[0].text': 'updated' }) },
    receive(event) { this.setData({ lastInput: event.detail.value }) },
  })`],
  ['pages/index/index.wxml', '<tree-node generic:editor="leaf-editor" node="{{tree}}" bind:edit="receive"/><text id="input-result">{{lastInput}}</text>'],
  ['components/node.json', '{"component":true,"componentGenerics":{"editor":true},"usingComponents":{"tree-node":"/components/node"}}'],
  ['components/node.js', `Component({
    properties: { node: { type: Object, observer: 'project' } },
    data: { view: null },
    methods: {
      project(node) {
        if (this.lastNode === node) return
        this.lastNode = node
        this.setData({ view: JSON.parse(JSON.stringify(node)) })
      },
      forward(event) { this.triggerEvent('edit', event.detail) },
      input(event) { this.triggerEvent('edit', { id: this.properties.node.id, value: event.detail.value }) },
    },
  })`],
  ['components/node.wxml', '<view wx:if="{{view}}"><text id="{{view.id}}">{{view.text}}</text><editor wx:if="{{view.id === \'leaf\'}}" node="{{view}}" bind:edit="forward"/><tree-node generic:editor="editor" wx:for="{{view.children}}" wx:key="id" node="{{item}}" bind:edit="forward"/></view>'],
]
