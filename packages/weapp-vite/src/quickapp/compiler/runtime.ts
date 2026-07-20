export const QUICKAPP_VUE_RUNTIME_FILE = 'Common/weapp-vite-vue.js'

export const quickAppVueRuntimeSource = `let activeEffect
let currentLifecycle

function createDependency() {
  return new Set()
}

function track(dependency) {
  if (activeEffect) {
    dependency.add(activeEffect)
  }
}

function trigger(dependency) {
  Array.from(dependency).forEach(effect => effect())
}

export function ref(initialValue) {
  const dependency = createDependency()
  const subscribers = createDependency()
  let value = initialValue
  return {
    __quickappRef: true,
    get value() {
      track(dependency)
      return value
    },
    set value(nextValue) {
      if (Object.is(value, nextValue)) return
      value = nextValue
      trigger(dependency)
      subscribers.forEach(subscriber => subscriber(value))
    },
    __subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    }
  }
}

export const shallowRef = ref

export function isRef(value) {
  return Boolean(value && value.__quickappRef)
}

export function unref(value) {
  return isRef(value) ? value.value : value
}

export function computed(getter) {
  const result = ref()
  const update = () => {
    const previousEffect = activeEffect
    activeEffect = update
    try {
      result.value = getter()
    }
    finally {
      activeEffect = previousEffect
    }
  }
  update()
  return result
}

export function reactive(target) {
  const dependencyMap = new Map()
  const subscribers = createDependency()
  const proxy = new Proxy(target, {
    get(object, key) {
      let dependency = dependencyMap.get(key)
      if (!dependency) {
        dependency = createDependency()
        dependencyMap.set(key, dependency)
      }
      track(dependency)
      return object[key]
    },
    set(object, key, value) {
      if (Object.is(object[key], value)) return true
      object[key] = value
      trigger(dependencyMap.get(key) || createDependency())
      subscribers.forEach(subscriber => subscriber(proxy))
      return true
    }
  })
  Object.defineProperty(proxy, '__quickappReactive', { value: true })
  Object.defineProperty(proxy, '__subscribe', {
    value(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    }
  })
  return proxy
}

export const readonly = reactive
export const shallowReactive = reactive

export function toRef(object, key) {
  return {
    __quickappRef: true,
    get value() { return object[key] },
    set value(value) { object[key] = value },
    __subscribe(subscriber) {
      return object.__subscribe ? object.__subscribe(() => subscriber(object[key])) : () => {}
    }
  }
}

export function toRefs(object) {
  return Object.keys(object).reduce((result, key) => {
    result[key] = toRef(object, key)
    return result
  }, {})
}

export function watch(source, callback, options = {}) {
  const getter = isRef(source) ? () => source.value : typeof source === 'function' ? source : () => source
  let oldValue
  const update = () => {
    const previousEffect = activeEffect
    activeEffect = update
    let newValue
    try {
      newValue = getter()
    }
    finally {
      activeEffect = previousEffect
    }
    if (options.immediate || oldValue !== undefined) callback(newValue, oldValue)
    oldValue = newValue
    options.immediate = false
  }
  update()
  return () => {}
}

export function watchEffect(effect) {
  return watch(effect, () => {})
}

export function nextTick(callback) {
  const promise = Promise.resolve()
  return callback ? promise.then(callback) : promise
}

function registerLifecycle(name, callback) {
  if (!currentLifecycle) return
  currentLifecycle[name].push(callback)
}

export const onBeforeMount = callback => registerLifecycle('beforeMount', callback)
export const onMounted = callback => registerLifecycle('mounted', callback)
export const onBeforeUnmount = callback => registerLifecycle('beforeUnmount', callback)
export const onUnmounted = callback => registerLifecycle('unmounted', callback)
export const onActivated = callback => registerLifecycle('activated', callback)
export const onDeactivated = callback => registerLifecycle('deactivated', callback)

function callLifecycle(instance, name) {
  const lifecycle = instance.__quickappVueLifecycle
  if (lifecycle) lifecycle[name].forEach(callback => callback.call(instance))
}

function bindSetupState(instance, state) {
  Object.keys(state || {}).forEach((key) => {
    const value = state[key]
    if (typeof value === 'function') {
      instance[key] = value
      return
    }
    if (isRef(value)) {
      instance[key] = value.value
      value.__subscribe(nextValue => { instance[key] = nextValue })
      return
    }
    instance[key] = value
    if (value && value.__quickappReactive && value.__subscribe) {
      value.__subscribe(() => { instance[key] = Object.assign({}, value) })
    }
  })
}

export function defineComponent(options) {
  const props = options.props || {}
  const bindings = (options.__quickappBindings || []).filter(key => !(key in props))
  const quickapp = {
    private: bindings.reduce((result, key) => {
      result[key] = null
      return result
    }, {}),
    props,
    onInit() {
      const lifecycle = {
        beforeMount: [], mounted: [], beforeUnmount: [], unmounted: [], activated: [], deactivated: []
      }
      Object.defineProperty(this, '__quickappVueLifecycle', { value: lifecycle })
      currentLifecycle = lifecycle
      let state
      try {
        state = options.setup ? options.setup(this, {
          expose() {},
          emit: (name, detail) => this.$emit(name, detail)
        }) : {}
      }
      finally {
        currentLifecycle = null
      }
      bindSetupState(this, state)
      callLifecycle(this, 'beforeMount')
    },
    onReady() { callLifecycle(this, 'mounted') },
    onShow() { callLifecycle(this, 'activated') },
    onHide() { callLifecycle(this, 'deactivated') },
    onDestroy() {
      callLifecycle(this, 'beforeUnmount')
      callLifecycle(this, 'unmounted')
    }
  }
  return quickapp
}
`
