import { io } from 'socket.io-client'
import {
  appendChatMessage,
  appendPresenceMessage,
  chatRoom,
  createInitialChatData,
  createMiniUserId,
  defineChatPage,
  getMessageAnchor,
  miniUserName,
  socketUrl,
} from './chat'

defineChatPage({
  socket: undefined,
  data: createInitialChatData(),
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

    socket.on('history', (history) => {
      this.setMessages(history)
    })

    socket.on('chat:message', (message) => {
      this.setMessages(appendChatMessage(this.data.messages, message))
    })

    socket.on('presence', (event) => {
      this.setMessages(appendPresenceMessage(this.data.messages, event))
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
  setMessages(messages) {
    const latest = messages.at(-1)
    this.setData({
      messages,
      scrollIntoView: getMessageAnchor(latest),
    })
  },
})
