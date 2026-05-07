/**
 * @file 百度智能小程序自动化图像工具。
 */
import type { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'

export async function drawBorder(imageBuffer: Buffer) {
  return imageBuffer
}

export async function extract(imageBuffer: Buffer) {
  return imageBuffer
}

export async function border(imageBuffer: Buffer) {
  return imageBuffer
}

export async function save(buffer: Buffer, targetPath?: string) {
  if (targetPath) {
    await fs.writeFile(targetPath, buffer)
  }
  return buffer
}

export const image = {
  border,
  drawBorder,
  extract,
}
