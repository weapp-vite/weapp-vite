import axios from 'axios'
import { GraphQLClient, gql } from 'graphql-request'

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

const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'
const graphqlClient = new GraphQLClient(`${apiBase}/graphql`)

export async function loadContactProfile() {
  const response = await axios.get<ContactProfile>(`${apiBase}/api/contact`)
  return response.data
}

export async function loadMoments() {
  const response = await fetch(`${apiBase}/api/moments`)
  if (!response.ok) {
    throw new Error(`朋友圈动态加载失败：${response.status}`)
  }
  return await response.json() as {
    items: Moment[]
    refreshedAt: number
  }
}

export async function loadConversationInsight() {
  const query = gql`
    query ConversationInsight {
      conversationInsight {
        summary {
          title
          description
          health
        }
        metrics {
          label
          value
          trend
        }
        threads {
          id
          name
          unread
          lastMessage
        }
        actions {
          title
          detail
        }
      }
    }
  `
  const response = await graphqlClient.request<{ conversationInsight: ConversationInsight }>(query)
  return response.conversationInsight
}
