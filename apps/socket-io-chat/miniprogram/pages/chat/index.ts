import { io, type Socket } from 'socket.io-client'

interface ChatMessage {
  id: string
  room: string
  userId: string
  userName: string
  text: string
  platform: 'web' | 'mini' | 'server'
  createdAt: number
}

type ViewMessage = ChatMessage & {
  time: string
}

const room = 'wechat-chat-demo'
const socketUrl = import.meta.env.WEAPP_SOCKET_URL || 'http://127.0.0.1:3001'
const userId = `mini-${Date.now().toString(36)}`

let socket: Socket | undefined

Page({
  data: {
    connected: false,
    draft: '',
    messages: [] as ViewMessage[],
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
        userName: '小程序用户',
      })
    })

    socket.on('disconnect', () => {
      this.setData({ connected: false })
    })

    socket.on('history', (history: ChatMessage[]) => {
      this.setMessages(history)
    })

    socket.on('chat:message', (message: ChatMessage) => {
      this.setMessages([...(this.data.messages as ViewMessage[]), toViewMessage(message)])
    })

    socket.on('presence', (event: { type: 'join' | 'leave'; userName: string; at: number }) => {
      this.setMessages([
        ...(this.data.messages as ViewMessage[]),
        toViewMessage({
          id: `presence-${event.at}`,
          room,
          userId: 'server',
          userName: 'Socket.IO',
          text: `${event.userName}${event.type === 'join' ? '进入' : '离开'}了聊天室`,
          platform: 'server',
          createdAt: event.at,
        }),
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
      userName: '小程序用户',
      text,
      platform: 'mini',
    })
    this.setData({
      draft: '',
    })
  },
  goContact() {
    void wx.navigateTo({
      url: '/pages/contact/index',
    })
  },
  goMoments() {
    void wx.navigateTo({
      url: '/pages/moments/index',
    })
  },
  goInsights() {
    void wx.navigateTo({
      url: '/pages/insights/index',
    })
  },
  setMessages(messages: ChatMessage[] | ViewMessage[]) {
    const viewMessages = messages.map(toViewMessage)
    const latest = viewMessages.at(-1)
    this.setData({
      messages: viewMessages,
      scrollIntoView: latest ? `msg-${latest.id}` : '',
    })
  },
})

function toViewMessage(message: ChatMessage | ViewMessage): ViewMessage {
  return {
    ...message,
    time: 'time' in message ? message.time : formatTime(message.createdAt),
  }
}

function formatTime(value: number) {
  const date = new Date(value)
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}
