export interface PlatformAdapter {
  readonly name: string
}

export function wechat(): PlatformAdapter {
  return {
    name: 'wechat',
  }
}
