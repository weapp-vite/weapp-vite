import type { Moment } from './types'
import { apiBase } from './base'

export async function loadMomentsWithFetch() {
  const response = await fetch(`${apiBase}/api/moments`)
  if (!response.ok) {
    throw new Error(`朋友圈动态加载失败：${response.status}`)
  }
  return await response.json() as {
    items: Moment[]
    refreshedAt: number
  }
}
