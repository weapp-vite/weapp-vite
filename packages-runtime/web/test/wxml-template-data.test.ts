import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

const baseOptions = {
  id: '/src/pages/index/index.wxml',
  resolveTemplatePath: () => undefined,
  resolveWxsPath: () => undefined,
}

describe('compileWxml template data', () => {
  it('wraps data shorthand for template is', () => {
    const result = compileWxml({
      ...baseOptions,
      source: `
        <template name="card">
          <view>{{item}}-{{index}}</view>
        </template>
        <template is="card" data="{{item: item, index: index}}" />
      `,
    })

    expect(result.code).toContain('"{ item: item, index: index }"')
    expect(result.code).toContain('ctx.mergeScope')
  })

  it('keeps template invocation semantics with wx:if and object spread', () => {
    const result = compileWxml({
      ...baseOptions,
      source: `
        <template name="icon">
          <view>{{name}}</view>
        </template>
        <template
          wx:if="{{iconName}}"
          is="icon"
          data="{{tClass: classPrefix + '__icon', name: iconName, ...iconData}}"
        />
      `,
    })

    expect(result.code).toContain('"{ tClass: classPrefix + \'__icon\', name: iconName, ...iconData }"')
    expect(result.code).toContain('ctx.renderTemplate')
    expect(result.code).not.toContain('html`<template')
  })

  it('keeps data expression when no shorthand is used', () => {
    const result = compileWxml({
      ...baseOptions,
      source: `
        <template name="card">
          <view>{{item}}</view>
        </template>
        <template is="card" data="{{item}}" />
      `,
    })

    expect(result.code).toContain('ctx.eval("item"')
    expect(result.code).not.toContain('"{ item: item')
  })
})
