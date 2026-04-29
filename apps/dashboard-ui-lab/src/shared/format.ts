export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  return `${(bytes / 1024).toFixed(1)} KiB`
}

export function formatRouteLabel(route: string) {
  return route.replace(/^\//, '').replaceAll('/', ' / ')
}
