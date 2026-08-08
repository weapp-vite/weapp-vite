import type { MiniProgramHostProps } from './types'
import { createElement } from 'react'

function createHostComponent(type: string) {
  return function MiniProgramHostComponent(props: MiniProgramHostProps) {
    return createElement(type, props)
  }
}

export const Button = createHostComponent('button')
export const Input = createHostComponent('input')
export const Slot = createHostComponent('slot')
export const Text = createHostComponent('text')
export const View = createHostComponent('view')

export type NativeComponentProps<Props extends object> = Props & Omit<MiniProgramHostProps, keyof Props>

export function createNativeComponent<Props extends object = Record<string, unknown>>(type: string) {
  if (!type) {
    throw new TypeError('native component tag name must be a non-empty string')
  }
  return function MiniProgramNativeComponent(props: NativeComponentProps<Props>) {
    return createElement(type, props)
  }
}
