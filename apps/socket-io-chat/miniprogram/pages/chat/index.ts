import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

interface ChatMessage {
  id: string
  room: string
  userId: string
  userName: string
  text: string
  platform: 'web' | 'mini' | 'server'
  createdAt: number
}

const room = 'wechat-chat-demo'
const socketUrl = import.meta.env.WEAPP_SOCKET_URL || 'http://127.0.0.1:3001'
const userId = `mini-${Date.now().toString(36)}`

let socket: Socket | undefined

Page({
  data: {
    connected: false,
    draft: '',
    messages: [] as ChatMessage[],
    scrollIntoView: '',
    userId,
  },
  onLoad() {
    this.connectSocket()
  },
  onUnload() {
    socket?.disconnect()
    socket = undefined
  },
  connectSocket() {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      this.setData({ connected: true })
      socket?.emit('join', {
        room,
        userName: '我',
      })
    })

    socket.on('disconnect', () => {
      this.setData({ connected: false })
    })

    socket.on('history', (history: ChatMessage[]) => {
      this.setMessages(history)
    })

    socket.on('chat:message', (message: ChatMessage) => {
      this.setMessages([...(this.data.messages as ChatMessage[]), message])
    })

    socket.on('presence', (event: { type: 'join' | 'leave', userName: string, at: number }) => {
      this.setMessages([
        ...(this.data.messages as ChatMessage[]),
        {
          id: `presence-${event.at}`,
          room,
          userId: 'server',
          userName: 'Socket.IO',
          text: event.type === 'join' ? '对方已加入会话' : '对方已离开会话',
          platform: 'server',
          createdAt: event.at,
        },
      ])
    })
  },
  onDraftInput(event: WechatMiniprogram.Input) {
    this.setData({
      draft: event.detail.value,
    })
  },
  sendMessage() {
    const text = this.data.draft.trim()
    if (!text) {
      return
    }
    socket?.emit('chat:send', {
      room,
      userId,
      userName: '我',
      text,
      platform: 'mini',
    })
    this.setData({
      draft: '',
    })
  },
  setMessages(messages: ChatMessage[]) {
    const latest = messages.at(-1)
    this.setData({
      messages,
      scrollIntoView: latest ? `msg-${latest.id}` : '',
    })
  },
})
