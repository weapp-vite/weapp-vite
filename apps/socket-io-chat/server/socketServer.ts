import type http from 'node:http'
import { Server } from 'socket.io'
import {
  historyLimit,
  messages,
  roomName,
  type ChatMessage,
} from './data.js'

export function attachSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    socket.on('join', (payload: { room?: string; userName?: string } = {}) => {
      const room = normalizeRoom(payload.room)
      socket.join(room)
      socket.data.room = room
      socket.data.userName = payload.userName?.trim() || '访客'
      socket.emit('history', messages.filter(message => message.room === room).slice(-historyLimit))
      socket.to(room).emit('presence', {
        type: 'join',
        userName: socket.data.userName,
        at: Date.now(),
      })
    })

    socket.on('chat:send', (payload: Partial<ChatMessage> = {}) => {
      const room = normalizeRoom(payload.room ?? socket.data.room)
      const text = payload.text?.trim()
      if (!text) {
        return
      }

      const message: ChatMessage = {
        id: `${Date.now()}-${socket.id}`,
        room,
        userId: payload.userId || socket.id,
        userName: payload.userName?.trim() || socket.data.userName || '访客',
        text,
        platform: payload.platform === 'mini' ? 'mini' : 'web',
        createdAt: Date.now(),
      }

      messages.push(message)
      if (messages.length > historyLimit) {
        messages.splice(0, messages.length - historyLimit)
      }
      io.to(room).emit('chat:message', message)
    })

    socket.on('disconnect', () => {
      const room = socket.data.room
      if (!room) {
        return
      }
      socket.to(room).emit('presence', {
        type: 'leave',
        userName: socket.data.userName || '访客',
        at: Date.now(),
      })
    })
  })

  return io
}

function normalizeRoom(room: unknown) {
  return typeof room === 'string' && room.trim() ? room.trim() : roomName
}
