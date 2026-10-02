const componentEvents = new WeakSet<Event>()

/** 记录组件派发的事件身份，不修改公开事件名称或原生传播规则。 */
export function markComponentEvent<T extends Event>(event: T): T {
  componentEvents.add(event)
  return event
}

export function isComponentEvent(event: Event): boolean {
  return componentEvents.has(event)
}

/** 手势别名只接收原生手势或同名组件事件，不能串入组件的 DOM 同名事件。 */
export function matchesRuntimeEvent(event: Event, component: boolean, alias?: string): boolean {
  if (alias) {
    return event.type === alias ? isComponentEvent(event) : !isComponentEvent(event)
  }
  return !component || isComponentEvent(event)
}
