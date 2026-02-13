export function resolveCurrentPages<T>(navigationHistory: Array<{ instance?: T }>) {
  return navigationHistory
    .map(entry => entry.instance)
    .filter((instance): instance is T => Boolean(instance))
}

export function cloneLaunchOptions(options: AppLaunchOptions): AppLaunchOptions {
  return {
    path: options.path,
    scene: options.scene,
    query: { ...options.query },
    referrerInfo: { ...options.referrerInfo },
  }
}

export function resolveFallbackLaunchOptions(
  navigationHistory: Array<{ id: string, query: Record<string, string> }>,
): AppLaunchOptions {
  const entry = navigationHistory[navigationHistory.length - 1] ?? navigationHistory[0]
  if (!entry) {
    return {
      path: '',
      scene: 0,
      query: {},
      referrerInfo: {},
    }
  }
  return {
    path: entry.id,
    scene: 0,
    query: { ...entry.query },
    referrerInfo: {},
  }
}
