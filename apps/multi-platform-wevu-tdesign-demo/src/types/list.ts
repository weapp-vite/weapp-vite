export type ListStatus = 'processing' | 'pending' | 'done'
export type StatusFilterValue = 'all' | ListStatus

export interface ListItem {
  id: number
  title: string
  owner: string
  status: ListStatus
  deadline: string
  priority: string
}

export interface StatusFilter {
  value: StatusFilterValue
  label: string
  count?: number
}
