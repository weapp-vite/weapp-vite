export type WarnHandler = (message: string) => void

export function resolveWarnHandler(warn?: WarnHandler): WarnHandler {
  return warn ?? ((message: string) => {
    console.warn(message)
  })
}
