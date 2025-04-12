const CSS_LANGS_RE
  // eslint-disable-next-line regexp/no-unused-capturing-group
  = /\.(wxss|css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
export function isCSSRequest(request: string): boolean {
  return CSS_LANGS_RE.test(request)
}

export function isRegexp(value: unknown) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

export function regExpTest(arr: (string | RegExp)[], str: string, options?: { exact?: boolean }) {
  if (!Array.isArray(arr)) {
    throw new TypeError('paramater \'arr\' should be an Array of Regexp | String')
  }

  for (const item of arr) {
    if (typeof item === 'string') {
      if (options?.exact) {
        if (str === item) {
          return true
        }
      }
      else if (str.includes(item)) {
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
