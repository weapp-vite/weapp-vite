const DEFAULT_STATUS_BAR_HEIGHT = 20
const DEFAULT_NAVBAR_HEIGHT = 48
const MESSAGE_NAVBAR_GAP = 8

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
  const navbarHeight = menuTop > statusBarHeight && menuHeight > 0
    ? (menuTop - statusBarHeight) * 2 + menuHeight
    : DEFAULT_NAVBAR_HEIGHT

  return {
    messageOffset: [statusBarHeight + navbarHeight + MESSAGE_NAVBAR_GAP, 16],
    navbarStyle: [
      `height: calc(${statusBarHeight}px + ${navbarHeight}px)`,
      `padding-top: ${statusBarHeight}px`,
    ].join('; '),
  }
}
