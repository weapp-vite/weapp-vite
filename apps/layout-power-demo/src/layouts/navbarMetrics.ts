const DEFAULT_STATUS_BAR_HEIGHT = 20
const DEFAULT_NAVBAR_HEIGHT = 48
const DEFAULT_CAPSULE_WIDTH = '176rpx'
const DEFAULT_CAPSULE_HEIGHT = '64rpx'

function getMenuButtonRect() {
  try {
    if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
      return wx.getMenuButtonBoundingClientRect()
    }
  }
  catch {
    return undefined
  }

  return undefined
}

export function resolveNavbarMetrics() {
  let statusBarHeight = DEFAULT_STATUS_BAR_HEIGHT

  try {
    const systemInfo = wx.getSystemInfoSync()
    statusBarHeight = Number(systemInfo.statusBarHeight) || DEFAULT_STATUS_BAR_HEIGHT
  }
  catch {
    statusBarHeight = DEFAULT_STATUS_BAR_HEIGHT
  }

  const menuButtonRect = getMenuButtonRect()
  const menuTop = Number(menuButtonRect?.top) || 0
  const menuHeight = Number(menuButtonRect?.height) || 0
  const menuWidth = Number(menuButtonRect?.width) || 0
  const navbarHeight = menuTop > statusBarHeight && menuHeight > 0
    ? (menuTop - statusBarHeight) * 2 + menuHeight
    : DEFAULT_NAVBAR_HEIGHT
  const capsuleWidth = menuWidth > 0 ? `${menuWidth}px` : DEFAULT_CAPSULE_WIDTH
  const capsuleHeight = menuHeight > 0 ? `${menuHeight}px` : DEFAULT_CAPSULE_HEIGHT

  return {
    navbarStyle: [
      `height: calc(${statusBarHeight}px + ${navbarHeight}px)`,
      `padding-top: ${statusBarHeight}px`,
      `--demo-navbar-capsule-width: ${capsuleWidth}`,
      `--demo-navbar-capsule-height: ${capsuleHeight}`,
    ].join('; '),
  }
}
