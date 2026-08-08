import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { ReactLeafView } from './view'

interface ReactLeafInstance {
  data: {
    label?: string
    value?: number
  }
  setData: (payload: Record<string, unknown>, callback?: () => void) => void
  triggerEvent: (name: string, detail?: unknown) => void
}

const roots = new WeakMap<object, ReturnType<typeof createReactMiniProgramRoot>>()

function render(instance: ReactLeafInstance) {
  const root = roots.get(instance)
  if (!root) {
    return
  }
  const value = Number(instance.data.value ?? 0)
  root.render(createElement(ReactLeafView, {
    label: instance.data.label ?? '',
    onChange: () => instance.triggerEvent('change', {
      source: 'react-leaf',
      value: value + 1,
    }),
    value,
  }))
}

Component({
  properties: {
    label: String,
    value: Number,
  },
  observers: {
    'label, value': function () {
      render(this)
    },
  },
  lifetimes: {
    attached() {
      roots.set(this, createReactMiniProgramRoot(this, { renderMode: 'static-bindings' }))
      render(this)
    },
    detached() {
      roots.get(this)?.unmount()
      roots.delete(this)
    },
  },
  methods: {
    __weapp_vite_react_event(event: WechatMiniprogram.BaseEvent) {
      roots.get(this)?.dispatchEvent(event)
    },
  },
})
