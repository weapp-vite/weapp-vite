// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

export type WeappIntrinsicEventHandler<TReturn = void> = (...args: unknown[]) => TReturn
export type MiniProgramIntrinsicEventHandler<TReturn = void> = WeappIntrinsicEventHandler<TReturn>

export type WeappClassValue = string | Record<string, unknown> | WeappClassValue[] | null | undefined | false
export type WeappStyleValue = false | null | undefined | string | WeappCSSProperties | WeappStyleValue[]
export type WeappDatasetValue = unknown

export interface WeappCSSProperties {
  [key: string]: string | number | undefined
  [v: `--${string}`]: string | number | undefined
}
export interface MiniProgramCSSProperties extends WeappCSSProperties {}

export type WeappDatasetAttributes = {
  [key in `data-${string}`]?: WeappDatasetValue
}
export type MiniProgramDatasetAttributes = WeappDatasetAttributes

export type WeappIntrinsicElementBaseAttributes = {
  id?: string | number
  class?: WeappClassValue
  style?: WeappStyleValue
  hidden?: boolean
} & WeappDatasetAttributes & Record<string, unknown>

export type MiniProgramIntrinsicElementBaseAttributes = WeappIntrinsicElementBaseAttributes
