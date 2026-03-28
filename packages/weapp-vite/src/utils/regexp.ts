export const CSS_LANGS_RE = /\.(wxss|css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
export function isCSSRequest(request: string): boolean {
  return CSS_LANGS_RE.test(request)
}

export function isRegexp(value: unknown) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

export function matchStringPattern(pattern: string, value: string, options?: { exact?: boolean }) {
  return options?.exact
    ? value === pattern
    : value.includes(pattern)
}

export function regExpTest(arr: (string | RegExp)[], str: string, options?: { exact?: boolean }) {
  if (!Array.isArray(arr)) {
    throw new TypeError('paramater \'arr\' should be an Array of Regexp | String')
  }

  for (const item of arr) {
    if (typeof item === 'string') {
      if (matchStringPattern(item, str, options)) {
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
