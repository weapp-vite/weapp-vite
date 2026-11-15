import { expect, it } from 'vitest'
import { stripGeneratedScopeAttrs } from './helpers'

it('removes generated scope classes and attributes without changing WXML expressions', () => {
  const source = String.raw`<view class="{{flag?"a":"b"}} data-v-one data-v-two" data-v-one="" data-v-two="" />`

  expect(stripGeneratedScopeAttrs(source))
    .toBe(String.raw`<view class="{{flag?"a":"b"}}" />`)
})

it('removes a generated class attribute when it only contains scope classes', () => {
  expect(stripGeneratedScopeAttrs('<view class="data-v-only" data-v-only="" />'))
    .toBe('<view />')
})

it('removes an unpaired generated scope class from a tag', () => {
  expect(stripGeneratedScopeAttrs('<view class="issue510-wrapper data-v-only"><slot /></view>'))
    .toBe('<view class="issue510-wrapper"><slot /></view>')
})
