import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createComponentFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-'))
  const write = (filePath: string, source: string) => {
    const target = path.join(root, filePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  write('project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' }))
  write('dist/app.json', JSON.stringify({ pages: ['pages/index/index'] }))
  write('dist/app.js', 'App({})')
  write('dist/pages/index/index.js', 'Page({})')
  write('dist/pages/index/index.wxml', '<text>page</text>')
  write('dist/components/subject/index.json', JSON.stringify({
    component: true,
    usingComponents: { middle: '../middle/index' },
  }))
  write('dist/components/subject/index.js', `Component({
    properties: {
      label: {
        type: String,
        value: 'initial',
        observer(value, previous) { const app = getApp(); (app.labelChanges ||= []).push({ value, previous }) },
      },
      value: { type: Number, value: 0 },
      payload: { type: Object, value: null },
    },
    data: { local: 1 },
    lifetimes: {
      created() { getApp().created = (getApp().created || 0) + 1 },
      attached() { getApp().attached = (getApp().attached || 0) + 1; this.triggerEvent('mount', { phase: 'attached' }) },
      detached() { getApp().detached = (getApp().detached || 0) + 1; if (this.data.failDetach) throw new Error('detached failure') },
    },
    methods: {
      emit() { this.triggerEvent('change', { local: this.data.local, label: this.properties.label }) },
      emitNamed(name, detail) { this.triggerEvent(name, detail) },
      lifecycleState() { return getApp() },
      observerState() { return getApp().labelChanges || [] },
      state() { return { created: getApp().created, attached: getApp().attached, local: this.data.local, label: this.properties.label, value: this.properties.value } },
    },
  })`)
  write('dist/components/subject/index.wxml', '<view data-testid="subject"><text>{{label}}:{{value}}:{{local}}</text><middle label="{{label}}"/><slot/></view>')
  write('dist/components/middle/index.json', JSON.stringify({
    component: true,
    usingComponents: { leaf: '../leaf/index' },
  }))
  write('dist/components/middle/index.js', 'Component({ properties: { label: String } })')
  write('dist/components/middle/index.wxml', '<leaf label="{{label}}"/>')
  write('dist/components/leaf/index.json', JSON.stringify({ component: true }))
  write('dist/components/leaf/index.js', 'Component({ properties: { label: String } })')
  write('dist/components/leaf/index.wxml', '<text>original {{label}}</text>')
  write('dist/components/replacement/index.json', JSON.stringify({ component: true }))
  write('dist/components/replacement/index.js', 'Component({ properties: { label: String } })')
  write('dist/components/replacement/index.wxml', '<text>replacement {{label}}</text>')
  return root
}
