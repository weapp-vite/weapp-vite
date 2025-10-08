export interface WatcherInstance {
  close: () => void | Promise<void>
}

export interface SidecarWatcher {
  close: () => void | Promise<void>
}
