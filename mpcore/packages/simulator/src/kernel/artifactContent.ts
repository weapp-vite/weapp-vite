export type ArtifactContent = string | ArrayBuffer

/** 二进制产物与虚拟文件共享字节转换，读写边界均复制以隔离调用方修改。 */
export function copyArtifactBinary(content: ArtifactContent): ArrayBuffer {
  return typeof content === 'string'
    ? new TextEncoder().encode(content).buffer
    : new Uint8Array(content).slice().buffer
}

export function readArtifactText(content: ArtifactContent): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content)
}
