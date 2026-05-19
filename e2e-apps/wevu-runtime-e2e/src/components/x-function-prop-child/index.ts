Component({
  properties: {
    callback: {
      type: Function,
      value: undefined,
    },
    handler: {
      type: Function,
      value: undefined,
    },
    metaTitle: {
      type: String,
      value: '',
    },
    dynamicLabel: {
      type: null,
      value: '',
    },
  },
  data: {
    callbackType: 'unset',
    handlerType: 'unset',
  },
  methods: {
    invokeCallback(this: any, payload = 'callback') {
      const callback = this.data?.callback
      const type = typeof callback
      const value = type === 'function' ? callback(payload) : undefined
      const data: Record<string, any> = { callbackType: type }
      if (value !== undefined) {
        data.callbackValue = value
      }
      this.setData?.(data)
      return {
        type,
        value,
      }
    },
    invokeHandler(this: any, payload = 'handler') {
      const handler = this.data?.handler
      const type = typeof handler
      const value = type === 'function' ? handler(payload) : undefined
      const data: Record<string, any> = { handlerType: type }
      if (value !== undefined) {
        data.handlerValue = value
      }
      this.setData?.(data)
      return {
        type,
        value,
      }
    },
    inspectProps(this: any) {
      const data = this.data ?? {}
      return {
        callbackType: typeof data.callback,
        handlerType: typeof data.handler,
        metaTitle: data.metaTitle,
        dynamicLabel: data.dynamicLabel,
      }
    },
  },
})
