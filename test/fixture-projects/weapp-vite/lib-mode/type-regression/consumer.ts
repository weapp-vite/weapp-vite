import type { TemplateRefValue } from 'wevu'
import type NativeComponent from './dist/TemplateRefs.js'
import type BrowserComponent from './dist/VueMap.js'

type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T
type Native = InstanceType<typeof NativeComponent>
type Browser = InstanceType<typeof BrowserComponent>

export type ViewRef = Assert<Equal<Native['viewRef'], TemplateRefValue | null>>
export type MapRef = Assert<Equal<Native['mapRef'], TemplateRefValue | null>>
export type RepeatedRef = Assert<Equal<Native['repeatedRef'], TemplateRefValue[] | null>>
export type ExplicitRef = Assert<Equal<Native['explicitRef'], { code: number } | null>>
export type ExposedMethod = Assert<Equal<NonNullable<Native['childRef']>['open'], (count: number) => number>>
export type BrowserMapRef = Assert<Equal<Browser['mapRef'], HTMLMapElement | null>>
export type BrowserMapGlobal = Assert<Equal<HTMLElementTagNameMap['map'], HTMLMapElement>>

declare const native: Native
declare const browser: Browser
native.viewRef?.boundingClientRect()
native.mapRef?.scrollOffset()
native.childRef?.open(1)
browser.mapRef?.areas.item(0)

// @ts-expect-error 小程序 ref 不提供浏览器 map 的 areas 集合。
native.mapRef?.areas
// @ts-expect-error 浏览器 map 不提供小程序 ref 的选择器。
browser.mapRef?.selector
