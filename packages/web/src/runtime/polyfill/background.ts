import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'

function normalizeBackgroundColorValue(color: unknown) {
  if (typeof color !== 'string') {
    return ''
  }
  return color.trim()
}

export function setBackgroundColorBridge(options?: SetBackgroundColorOptions) {
  const backgroundColor = normalizeBackgroundColorValue(options?.backgroundColor)
  const backgroundColorTop = normalizeBackgroundColorValue(options?.backgroundColorTop)
  const backgroundColorBottom = normalizeBackgroundColorValue(options?.backgroundColorBottom)
  const runtimeDocument = typeof document !== 'undefined' ? document : undefined
  const rootElement = runtimeDocument?.documentElement
  const body = runtimeDocument?.body

  if (body && backgroundColor) {
    body.style.backgroundColor = backgroundColor
  }
  if (rootElement && backgroundColorTop && backgroundColorBottom) {
    rootElement.style.setProperty(
      '--weapp-web-background-gradient',
      `linear-gradient(${backgroundColorTop}, ${backgroundColorBottom})`,
    )
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setBackgroundColor:ok' }))
}

export function setBackgroundTextStyleBridge(options?: SetBackgroundTextStyleOptions) {
  const textStyle = options?.textStyle
  if (textStyle !== undefined && textStyle !== 'dark' && textStyle !== 'light') {
    const failure = callWxAsyncFailure(options, 'setBackgroundTextStyle:fail invalid textStyle')
    return Promise.reject(failure)
  }
  if (typeof document !== 'undefined' && document.documentElement && textStyle) {
    document.documentElement.setAttribute('data-weapp-background-text-style', textStyle)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setBackgroundTextStyle:ok' }))
}
