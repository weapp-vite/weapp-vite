function reportRenderedValue(caseName: unknown, value: unknown) {
  if (typeof caseName !== 'string' || !caseName) {
    return
  }
  const pages = getCurrentPages() as Array<Record<string, any>>
  const currentPage = pages[pages.length - 1]
  if (!currentPage) {
    return
  }
  const renderedCases = currentPage.__issue558RenderedCases
    ?? (currentPage.__issue558RenderedCases = {})
  if (caseName === 'listScoped') {
    const values = Array.isArray(renderedCases.listScoped)
      ? renderedCases.listScoped
      : (renderedCases.listScoped = [])
    if (typeof value === 'string' && value && !values.includes(value)) {
      values.push(value)
    }
    return
  }
  renderedCases[caseName] = typeof value === 'string' ? value : ''
}

Component({
  properties: {
    caseName: {
      type: String,
      value: '',
    },
    value: {
      type: null,
      value: null,
    },
  },
  observers: {
    'caseName, value': function (caseName: string, value: unknown) {
      reportRenderedValue(caseName, value)
    },
  },
  lifetimes: {
    ready() {
      reportRenderedValue(this.properties.caseName, this.properties.value)
    },
  },
})
