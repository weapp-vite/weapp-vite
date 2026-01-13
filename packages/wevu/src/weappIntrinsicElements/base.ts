// This file is auto-generated from components.json. Do not edit directly.

export type WeappIntrinsicEventHandler<TReturn = void> = (...args: unknown[]) => TReturn

export type WeappClassValue = string | Record<string, unknown> | WeappClassValue[] | null | undefined | false
export type WeappStyleValue = false | null | undefined | string | WeappCSSProperties | WeappStyleValue[]
export type WeappDatasetValue = unknown

export interface WeappCSSProperties {
  [key: string]: string | number | undefined
  [v: `--${string}`]: string | number | undefined
}

export type WeappDatasetAttributes = {
  [key in `data-${string}`]?: WeappDatasetValue
}

export type WeappIntrinsicElementBaseAttributes = {
  id?: string
  class?: WeappClassValue
  style?: WeappStyleValue
  hidden?: boolean
} & WeappDatasetAttributes & Record<string, unknown>
