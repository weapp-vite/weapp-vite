function createUnsupportedWxApi(name: string) {
  return () => {
    throw new Error(`wx.${name} is not implemented in headless runtime yet.`)
  }
}

export interface HeadlessWx {
  navigateBack: () => never
  navigateTo: () => never
  pageScrollTo: () => never
  reLaunch: () => never
  redirectTo: () => never
  switchTab: () => never
}

export function createHeadlessWx(): HeadlessWx {
  return {
    navigateBack: createUnsupportedWxApi('navigateBack'),
    navigateTo: createUnsupportedWxApi('navigateTo'),
    pageScrollTo: createUnsupportedWxApi('pageScrollTo'),
    reLaunch: createUnsupportedWxApi('reLaunch'),
    redirectTo: createUnsupportedWxApi('redirectTo'),
    switchTab: createUnsupportedWxApi('switchTab'),
  }
}
