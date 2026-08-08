import { WEAPP_REACT_EVENT_METHOD_NAME } from '@weapp-core/constants'

const MAX_TEMPLATE_DEPTH = 4

function renderHostAttributes(tag: 'button' | 'input' | 'text' | 'view') {
  const common = 'id="{{i.p.id}}" class="{{i.cl}}" style="{{i.st}}" data-sid="{{i.sid}}"'
  if (tag === 'button') {
    return `${common} disabled="{{i.p.disabled}}" bindtap="${WEAPP_REACT_EVENT_METHOD_NAME}"`
  }
  if (tag === 'input') {
    return `${common} value="{{i.p.value}}" type="{{i.p.type}}" checked="{{i.p.checked}}" disabled="{{i.p.disabled}}" placeholder="{{i.p.placeholder}}" bindinput="${WEAPP_REACT_EVENT_METHOD_NAME}" bindchange="${WEAPP_REACT_EVENT_METHOD_NAME}"`
  }
  return `${common} hidden="{{i.p.hidden}}" bindtap="${WEAPP_REACT_EVENT_METHOD_NAME}"`
}

function renderHost(tag: 'button' | 'input' | 'text' | 'view', depth: number) {
  const attributes = renderHostAttributes(tag)
  if (tag === 'input' || depth === MAX_TEMPLATE_DEPTH) {
    return `  <${tag} wx:elif="{{i.nn === '${tag}'}}" ${attributes} />`
  }
  return [
    `  <${tag} wx:elif="{{i.nn === '${tag}'}}" ${attributes}>`,
    '    <block wx:for="{{i.cn}}" wx:key="sid" wx:for-item="child">',
    `      <template is="react_node_${depth + 1}" data="{{i:child}}" />`,
    '    </block>',
    `  </${tag}>`,
  ].join('\n')
}

function renderNodeTemplate(depth: number) {
  return [
    `<template name="react_node_${depth}">`,
    '  <block wx:if="{{i.nn === \'#text\'}}">{{i.v}}</block>',
    renderHost('view', depth),
    renderHost('text', depth),
    renderHost('button', depth),
    renderHost('input', depth),
    '</template>',
  ].join('\n')
}

export const baseTemplate = [
  '<template name="react_root">',
  '  <block wx:for="{{root.cn}}" wx:key="sid" wx:for-item="child">',
  '    <template is="react_node_0" data="{{i:child}}" />',
  '  </block>',
  '</template>',
  '',
  ...Array.from({ length: MAX_TEMPLATE_DEPTH + 1 }, (_, depth) => renderNodeTemplate(depth)),
  '',
].join('\n')
