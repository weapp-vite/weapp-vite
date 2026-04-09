import type { WeappIntrinsicElements } from '@/weappIntrinsicElements'
import { expectError, expectType } from 'tsd'

type ButtonAttrs = WeappIntrinsicElements['button']

const liveActivityButton: ButtonAttrs = {
  'open-type': 'liveActivity',
  'createliveactivity': () => {},
}
expectType<ButtonAttrs>(liveActivityButton)

const realtimePhoneButton: ButtonAttrs = {
  'open-type': 'getRealtimePhoneNumber',
  'bindgetrealtimephonenumber': () => {},
}
expectType<ButtonAttrs>(realtimePhoneButton)

const chooseAvatarButton: ButtonAttrs = {
  'open-type': 'chooseAvatar',
  'bindchooseavatar': () => {},
}
expectType<ButtonAttrs>(chooseAvatarButton)

const privacyButton: ButtonAttrs = {
  'open-type': 'agreePrivacyAuthorization',
  'bindagreeprivacyauthorization': () => {},
}
expectType<ButtonAttrs>(privacyButton)

const launchAppButton: ButtonAttrs = {
  'open-type': 'launchApp',
  'bindlaunchapp': () => {},
}
expectType<ButtonAttrs>(launchAppButton)

expectError<ButtonAttrs>({
  'open-type': 'not-exist',
})

type MapAttrs = WeappIntrinsicElements['map']
type DivAttrs = WeappIntrinsicElements['div']
type SpanAttrs = WeappIntrinsicElements['span']
type ImageAliasAttrs = WeappIntrinsicElements['img']
type AnchorAliasAttrs = WeappIntrinsicElements['a']

declare const mapAttrs: MapAttrs
expectType<string | number | undefined>(mapAttrs.id)
expectType<WeappIntrinsicElements['view']>({} as DivAttrs)
expectType<WeappIntrinsicElements['text']>({} as SpanAttrs)
expectType<WeappIntrinsicElements['image']>({} as ImageAliasAttrs)
expectType<WeappIntrinsicElements['navigator']>({} as AnchorAliasAttrs)

expectType<MapAttrs>({
  id: 'map-1',
})

expectType<MapAttrs>({
  id: 1,
})

expectError<MapAttrs>({
  id: true,
})

expectType<DivAttrs>({
  class: 'page',
  hidden: false,
})

expectType<SpanAttrs>({
  selectable: true,
})

expectType<ImageAliasAttrs>({
  src: '/static/banner.png',
})

expectType<AnchorAliasAttrs>({
  url: '/pages/home/index',
})

expectError<SpanAttrs>({
  src: '/static/banner.png',
})
