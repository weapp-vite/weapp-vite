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

const userId = createMiniUserId()

let socket: Socket | undefined

Page({
  data: {
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
      socket?.emit('join', {
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
    socket?.emit('chat:send', {
      room: chatRoom,
      userId,
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
