const { AppPlatform, platform: platformValue, model } = wx.getSystemInfoSync() || {}
export const isWx = AppPlatform !== 'qq' && AppPlatform !== 'tim'
export const isWindows = platformValue === 'windows'
export const isMac = platformValue === 'mac'
export const isQQ = AppPlatform == 'qq' || AppPlatform === 'tim'
export const isIpad = platformValue === 'ios' && /ipad/i.test(model)
export const isPC = platformValue === 'windows' || platformValue === 'mac' || isIpad
export const isIos = platformValue === 'ios'
export const isDevTools = platformValue === 'devtools'

