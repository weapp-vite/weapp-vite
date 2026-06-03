<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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

const room = 'wechat-chat-demo'
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001'
const userId = `web-${Date.now().toString(36)}`
const userName = 'Web 用户'

const connected = ref(false)
const draft = ref('')
const messages = ref<ChatMessage[]>([])
const messageList = ref<HTMLElement>()
let socket: Socket | undefined

onMounted(() => {
  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => {
    connected.value = true
    socket?.emit('join', { room, userName })
  })

  socket.on('disconnect', () => {
    connected.value = false
  })

  socket.on('history', (history: ChatMessage[]) => {
    messages.value = history
    scrollToBottom()
  })

  socket.on('chat:message', (message: ChatMessage) => {
    messages.value.push(message)
    scrollToBottom()
  })

  socket.on('presence', (event: { type: 'join' | 'leave'; userName: string; at: number }) => {
    messages.value.push({
      id: `presence-${event.at}`,
      room,
      userId: 'server',
      userName: 'Socket.IO',
      text: `${event.userName}${event.type === 'join' ? '进入' : '离开'}了聊天室`,
      platform: 'server',
      createdAt: event.at,
    })
    scrollToBottom()
  })
})

onBeforeUnmount(() => {
  socket?.disconnect()
})

function sendMessage() {
  const text = draft.value.trim()
  if (!text) {
    return
  }

  socket?.emit('chat:send', {
    room,
    userId,
    userName,
    text,
    platform: 'web',
  })
  draft.value = ''
}

function isMine(message: ChatMessage) {
  return message.userId === userId
}

function formatTime(value: number) {
  const date = new Date(value)
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}
</script>

<template>
  <section class="chat-panel">
    <header class="chat-header">
      <div>
        <h1>Socket.IO 聊天室</h1>
        <p>Web 与 weapp-vite 小程序实时互通</p>
      </div>
      <span class="chat-status" :class="{ 'chat-status--online': connected }">
        {{ connected ? '在线' : '离线' }}
      </span>
    </header>

    <div ref="messageList" class="message-list">
      <article
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="{
          'message--mine': isMine(message),
          'message--system': message.platform === 'server',
        }"
      >
        <div v-if="message.platform !== 'server'" class="message__avatar">
          {{ message.platform === 'mini' ? '小' : 'W' }}
        </div>
        <div class="message__body">
          <div v-if="message.platform !== 'server'" class="message__meta">
            {{ message.userName }} · {{ formatTime(message.createdAt) }}
          </div>
          <div class="message__bubble">
            {{ message.text }}
          </div>
        </div>
      </article>
    </div>

    <form class="composer" @submit.prevent="sendMessage">
      <input
        v-model="draft"
        class="composer__input"
        autocomplete="off"
        placeholder="发消息"
      >
      <button class="composer__button" type="submit">
        发送
      </button>
    </form>
  </section>
</template>
