import { readFile } from 'node:fs/promises'

type RequestedReader = (file: string, read: () => Promise<string>) => Promise<string>
const readers = new WeakMap<object, RequestedReader>()

/** 配置解析与首构事件比较共享请求视图，避免临时 IDE 设置形成自身配置重启。 */
export function bindRequestedIdeConfigReader(owner: object, read: RequestedReader) {
  readers.set(owner, read)
}

export function readRequestedIdeConfig(owner: object, file: string, read = () => readFile(file, 'utf8')): Promise<string> {
  return readers.get(owner)?.(file, read) ?? read()
}
