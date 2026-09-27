import type { DemoSpec } from './schema'
import { evaluateVisibility, resolveBindings, resolveElementProps } from './core'

export interface DemoState {
  form: { reason: string }
  busy: boolean
  status: string
  error: string
  submitted: boolean
}

export interface RenderNode {
  id: string
  type: string
  props: { title?: string, text?: string, label?: string, placeholder?: string, value?: string, disabled?: boolean, number?: string, product?: string, amount?: string }
  children: RenderNode[]
}

export interface NodeEvent {
  id: string
  name: 'input' | 'press'
  value?: string
}

export function initialState(): DemoState {
  return { form: { reason: '' }, busy: false, status: '填写原因后提交申请', error: '', submitted: false }
}

export function projectSpec(spec: DemoSpec, state: DemoState): RenderNode | null {
  const context = { stateModel: { ...state } }
  function project(id: string): RenderNode | null {
    const node = spec.elements[id]!
    if (!evaluateVisibility(node.visible, context)) {
      return null
    }
    return {
      id,
      type: node.type,
      props: resolveElementProps(node.props, context) as RenderNode['props'],
      children: node.children.map(project).filter((child): child is RenderNode => child !== null),
    }
  }
  return project(spec.root)
}

export function inputBinding(spec: DemoSpec, id: string, state: DemoState) {
  const node = spec.elements[id]
  return node?.type === 'Input' ? resolveBindings(node.props, { stateModel: { ...state } })?.value : undefined
}
