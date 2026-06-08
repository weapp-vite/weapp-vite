import type { Socket } from 'socket.io-client'

export interface ChatMessage {
  id: string
  room: string
  userId: string
  userName: string
  text: string
  platform: 'web' | 'mini' | 'server'
  createdAt: number
}

export interface PresenceEvent {
  type: 'join' | 'leave'
  userName: string
  at: number
}

export interface ChatPageData {
  draft: string
  messages: ChatMessage[]
  scrollIntoView: string
  userId: string
}

export interface ChatPageCustom {
  socket?: Socket
  connectSocket: () => void
  onDraftInput: (event: WechatMiniprogram.Input) => void
  sendMessage: () => void
  setMessages: (messages: ChatMessage[]) => void
}

export function defineChatPage(options: WechatMiniprogram.Page.Options<ChatPageData, ChatPageCustom>) {
  Page<ChatPageData, ChatPageCustom>(options)
}

export const chatRoom = 'wechat-chat-demo'
export const miniUserName = '我'
export const socketUrl = import.meta.env.WEAPP_SOCKET_URL || 'http://127.0.0.1:3001'

export function createInitialChatData(): ChatPageData {
  return {
    draft: '',
    messages: [],
    scrollIntoView: '',
    userId: '',
  }
}

export function createMiniUserId() {
  return `mini-${Date.now().toString(36)}`
}

export function createPresenceMessage(event: PresenceEvent): ChatMessage {
  return {
    id: `presence-${event.at}`,
    room: chatRoom,
    userId: 'server',
    userName: 'system',
    text: event.type === 'join' ? '对方已加入会话' : '对方已离开会话',
    platform: 'server',
    createdAt: event.at,
  }
}

export function appendChatMessage(messages: ChatMessage[], message: ChatMessage) {
  return [...messages, message]
}

export function appendPresenceMessage(messages: ChatMessage[], event: PresenceEvent) {
  return appendChatMessage(messages, createPresenceMessage(event))
}

export function getMessageAnchor(message: ChatMessage | undefined) {
  return message ? `msg-${message.id}` : ''
}
