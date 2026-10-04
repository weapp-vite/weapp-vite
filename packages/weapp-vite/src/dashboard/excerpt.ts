import type { DashboardFileContent } from './content'
import type { DashboardFileRangeRequest } from './schema'

/** 按已校验的 UTF-16 范围截取内容，保留换行与代理项，不改变完整文件大小。 */
export function createDashboardFileExcerpt(
  content: string,
  range?: DashboardFileRangeRequest,
): Pick<DashboardFileContent, 'content' | 'range'> {
  if (!range) {
    return { content }
  }
  const totalCharacters = content.length
  if (range.offset > totalCharacters) {
    throw new RangeError('文件读取偏移超出内容范围。')
  }
  const end = Math.min(totalCharacters, range.offset + range.limit)
  return {
    content: content.slice(range.offset, end),
    range: {
      offset: range.offset,
      totalCharacters,
      nextOffset: end < totalCharacters ? end : null,
    },
  }
}
