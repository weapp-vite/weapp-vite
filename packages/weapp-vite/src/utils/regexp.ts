const CSS_LANGS_RE
  // eslint-disable-next-line regexp/no-unused-capturing-group
  = /\.(wxss|css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
export function isCSSRequest(request: string): boolean {
  return CSS_LANGS_RE.test(request)
}

export function isRegexp(value: unknown) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

export function regExpTest(arr: (string | RegExp)[], str: string) {
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (typeof item === 'string') {
        if (str.includes(item)) {
          return true
        }
      }
      else if (isRegexp(item)) {
        item.lastIndex = 0
        if (item.test(str)) {
          return true
        }
      }
    }
    return false
  }
  throw new TypeError('paramater \'arr\' should be a Array of Regexp | String !')
}
