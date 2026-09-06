/** @jsxImportSource wevu */
import type { WevuJsxElement } from 'wevu/jsx-runtime'

declare function Panel(props: { title: string }): WevuJsxElement

export const panel = <Panel title="neutral" />

// @ts-expect-error renderer-neutral JSX 不包含平台原生标签。
export const nativeView = <view />
