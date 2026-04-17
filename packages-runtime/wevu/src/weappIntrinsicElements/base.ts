// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

export type MiniProgramIntrinsicEventHandler<TReturn = void> = (...args: unknown[]) => TReturn
export type WeappIntrinsicEventHandler<TReturn = void> = MiniProgramIntrinsicEventHandler<TReturn>

export type MiniProgramClassValue = string | Record<string, unknown> | MiniProgramClassValue[] | null | undefined | false
export type WeappClassValue = MiniProgramClassValue

export type MiniProgramStyleValue = false | null | undefined | string | MiniProgramCSSProperties | MiniProgramStyleValue[]
export type WeappStyleValue = MiniProgramStyleValue

export type MiniProgramDatasetValue = unknown
export type WeappDatasetValue = MiniProgramDatasetValue

export interface MiniProgramCSSProperties {
  [key: string]: string | number | undefined
  [v: `--${string}`]: string | number | undefined
}
export interface WeappCSSProperties extends MiniProgramCSSProperties {}

export type MiniProgramDatasetAttributes = {
  [key in `data-${string}`]?: MiniProgramDatasetValue
}
export type WeappDatasetAttributes = MiniProgramDatasetAttributes

export type MiniProgramIntrinsicElementBaseAttributes = {
  id?: string | number
  class?: MiniProgramClassValue
  style?: MiniProgramStyleValue
  hidden?: boolean
} & MiniProgramDatasetAttributes & Record<string, unknown>
export type WeappIntrinsicElementBaseAttributes = MiniProgramIntrinsicElementBaseAttributes
