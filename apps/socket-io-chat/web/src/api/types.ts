export interface ContactProfile {
  id: string
  name: string
  title: string
  avatarText: string
  city: string
  status: string
  signature: string
  tags: string[]
  stats: Array<{
    label: string
    value: string
  }>
  recent: Array<{
    title: string
    detail: string
  }>
}

export interface Moment {
  id: string
  author: string
  avatarText: string
  time: string
  content: string
  cover: string
  likes: number
  comments: Array<{
    user: string
    text: string
  }>
}

export interface ConversationInsight {
  summary: {
    title: string
    description: string
    health: string
  }
  metrics: Array<{
    label: string
    value: string
    trend: string
  }>
  threads: Array<{
    id: string
    name: string
    unread: number
    lastMessage: string
  }>
  actions: Array<{
    title: string
    detail: string
  }>
}
