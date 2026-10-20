import type { TemplateRefValue } from 'wevu'

type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T

export type BrowserMap = Assert<Equal<HTMLElementTagNameMap['map'], HTMLMapElement>>
export type BrowserCanvas = Assert<Equal<HTMLElementTagNameMap['canvas'], HTMLCanvasElement>>
export type NoNativeView = Assert<Equal<'view' extends keyof HTMLElementTagNameMap ? true : false, false>>
export type NoAlipayLottie = Assert<Equal<'lottie' extends keyof HTMLElementTagNameMap ? true : false, false>>
export type NoTtMask = Assert<Equal<'mask' extends keyof HTMLElementTagNameMap ? true : false, false>>
export type EveryBrowserTagIsAnElement = Assert<HTMLElementTagNameMap[keyof HTMLElementTagNameMap] extends Element ? true : false>

declare const nativeRef: TemplateRefValue
const selector: string = nativeRef.selector
const map: HTMLMapElement = document.createElement('map')
void [selector, map]
