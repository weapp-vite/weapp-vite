import type { ListItem, ListStatus, StatusFilter, StatusFilterValue } from '@/types/list'

export function buildStatusFilters(items: ListItem[]): StatusFilter[] {
  const summary: Record<ListStatus, number> = {
    processing: 0,
    pending: 0,
    done: 0,
  }

  for (const item of items) {
    summary[item.status] += 1
  }

  return [
    { value: 'all', label: '全部', count: items.length },
    { value: 'processing', label: '进行中', count: summary.processing },
    { value: 'pending', label: '待启动', count: summary.pending },
    { value: 'done', label: '已完成', count: summary.done },
  ]
}

export function filterListItems(
  items: ListItem[],
  query: string,
  activeStatus: StatusFilterValue,
) {
  const keyword = query.trim()

  return items.filter((item) => {
    const matchStatus = activeStatus === 'all' || item.status === activeStatus
    const matchQuery = !keyword || item.title.includes(keyword) || item.owner.includes(keyword)
    return matchStatus && matchQuery
  })
}
