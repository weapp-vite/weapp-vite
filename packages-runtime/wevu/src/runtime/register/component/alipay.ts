import type { InternalRuntimeState } from '../../types'

type AlipayComponentInstance = InternalRuntimeState & {
  props: Record<string, any>
  properties: Record<string, any>
}

/** 支付宝通过函数属性派发自定义事件，补齐模板分派器需要的事件与数据集。 */
function triggerAlipayEvent(this: AlipayComponentInstance, eventName: string, detail: unknown) {
  const callbackName = `on${eventName.replace(/(^|-)([a-z0-9])/g, (_match, _separator, character: string) => character.toUpperCase())}`
  const callback = this.props[callbackName]
  if (typeof callback !== 'function') {
    return
  }
  const dataset: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(this.props)) {
    if (key.startsWith('data-')) {
      dataset[key.slice(5)] = value
    }
  }
  const target = { id: this.props.id, dataset }
  return callback({ type: eventName, detail, target, currentTarget: target })
}

/** 将宿主生命周期和 props 统一到现有组件运行时，避免维护第二套响应式挂载流程。 */
export function createAlipayComponentDefinition(definition: Record<string, any>) {
  const { lifetimes = {}, properties = {}, observers = {}, pageLifetimes = {}, ...rest } = definition
  const props: Record<string, unknown> = {}
  for (const [key, property] of Object.entries(properties)) {
    props[key] = property && typeof property === 'object' && 'value' in property ? property.value : null
  }

  return {
    ...rest,
    props,
    methods: {
      triggerEvent: triggerAlipayEvent,
      ...rest.methods,
    },
    onInit(this: AlipayComponentInstance) {
      this.properties = this.props
      lifetimes.created?.call(this)
    },
    didMount(this: AlipayComponentInstance) {
      this.properties = this.props
      lifetimes.attached?.call(this)
      lifetimes.ready?.call(this)
    },
    deriveDataFromProps(this: AlipayComponentInstance, nextProps: Record<string, any>) {
      const previous = this.properties ?? this.props
      // 支付宝此时的 this.props 仍是旧值，以回调参数作为唯一更新来源。
      this.properties = nextProps
      for (const key of Object.keys(properties)) {
        if (!Object.is(previous?.[key], nextProps[key])) {
          observers[key]?.call(this, nextProps[key], previous?.[key])
        }
      }
      observers['**']?.call(this, nextProps)
    },
    didUnmount(this: AlipayComponentInstance) {
      lifetimes.detached?.call(this)
    },
    pageEvents: {
      onShow(this: AlipayComponentInstance) {
        pageLifetimes.show?.call(this)
      },
      onHide(this: AlipayComponentInstance) {
        pageLifetimes.hide?.call(this)
      },
    },
  }
}
