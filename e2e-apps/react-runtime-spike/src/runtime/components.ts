import type { MiniProgramHostProps } from './types'
import { createElement } from 'react'

function createHostComponent(type: string) {
  return function MiniProgramHostComponent(props: MiniProgramHostProps) {
    return createElement(type, props)
  }
}

export const Button = createHostComponent('button')
export const Input = createHostComponent('input')
export const Text = createHostComponent('text')
export const View = createHostComponent('view')
