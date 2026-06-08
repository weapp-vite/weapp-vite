import type { PageInstance } from 'miniprogram-api-typings'
import type { Socket } from 'socket.io-client'
import type { ChatMessage, PresenceEvent } from './chat'
import { io } from 'socket.io-client'
import {
  chatRoom,
  createMiniUserId,
  createPresenceMessage,
  getMessageAnchor,
  miniUserName,
  socketUrl,
} from './chat'

interface ChatPageData {
  draft: string
  messages: ChatMessage[]
  scrollIntoView: string
  userId: string
}

interface ChatPageInstance extends PageInstance<ChatPageData> {
  socket?: Socket
  connectSocket: () => void
  setMessages: (messages: ChatMessage[]) => void
}

Page<ChatPageData, ChatPageInstance>({
  socket: undefined as Socket | undefined,
  data: {
    draft: '',
    messages: [] as ChatMessage[],
    scrollIntoView: '',
    userId: '',
  },
  onLoad() {
    this.setData({
      userId: createMiniUserId(),
    })
    this.connectSocket()
  },
  onUnload() {
    this.socket?.disconnect()
    this.socket = undefined
  },
  connectSocket() {
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    })
    this.socket = socket

    socket.on('connect', () => {
      socket.emit('join', {
        room: chatRoom,
        userName: miniUserName,
      })
    })

    socket.on('history', (history: ChatMessage[]) => {
      this.setMessages(history)
    })

    socket.on('chat:message', (message: ChatMessage) => {
      this.setMessages([...(this.data.messages as ChatMessage[]), message])
    })

    socket.on('presence', (event: PresenceEvent) => {
      this.setMessages([
        ...(this.data.messages as ChatMessage[]),
        createPresenceMessage(event),
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
    this.socket?.emit('chat:send', {
      room: chatRoom,
      userId: this.data.userId,
      userName: miniUserName,
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
      scrollIntoView: getMessageAnchor(latest),
    })
  },
})
