<script setup lang="ts">
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

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

  socket.on('presence', (event: { at: number, type: 'join' | 'leave', userName: string }) => {
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
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-center justify-between border-b border-black/10 bg-[#ededed] px-4.5 py-3.5">
      <div>
        <h1 class="m-0 text-[17px] leading-tight font-semibold">Socket.IO 聊天室</h1>
        <p class="mt-1 text-xs text-[#777]">Web 与 weapp-vite 小程序实时互通</p>
      </div>
      <span
        class="rounded-full px-2.5 py-1 text-xs"
        :class="connected ? 'bg-[#95ec69] text-[#07582f]' : 'bg-[#ddd] text-[#666]'"
      >
        {{ connected ? '在线' : '离线' }}
      </span>
    </header>

    <div ref="messageList" class="min-h-0 flex-1 overflow-y-auto bg-[#ededed]">
      <div class="flex min-h-full flex-col justify-end px-3.5 pt-4.5 pb-6">
        <article
          v-for="message in messages"
          :key="message.id"
          class="chat-message mb-3.5 flex items-start gap-2.5 last:mb-0"
          :class="{
            'flex-row-reverse': isMine(message),
            'justify-center': message.platform === 'server',
            'chat-message--mine': isMine(message),
            'chat-message--system': message.platform === 'server',
          }"
        >
          <div
            v-if="message.platform !== 'server'"
            class="flex size-9.5 shrink-0 items-center justify-center rounded bg-[#07c160] font-bold text-white"
            :class="{ 'bg-[#2f80ed]': isMine(message) }"
          >
            {{ message.platform === 'mini' ? '小' : 'W' }}
          </div>
          <div class="max-w-[286px]">
            <div
              v-if="message.platform !== 'server'"
              class="mb-1 text-xs text-[#888]"
              :class="{ 'text-right': isMine(message) }"
            >
              {{ message.userName }} · {{ formatTime(message.createdAt) }}
            </div>
            <div
              class="chat-message__bubble overflow-wrap-anywhere rounded px-3 py-2.5 leading-snug"
              :class="message.platform === 'server'
                ? 'max-w-[300px] rounded-full bg-black/8 px-3 py-1.5 text-center text-xs text-[#666]'
                : isMine(message)
                  ? 'bg-[#95ec69]'
                  : 'bg-[#f5f5f5]'"
            >
              {{ message.text }}
            </div>
          </div>
        </article>
      </div>
    </div>

    <form class="flex items-center gap-2.5 border-t border-black/10 bg-[#f7f7f7] p-3" @submit.prevent="sendMessage">
      <input
        v-model="draft"
        class="h-10 min-w-0 flex-1 rounded border-0 bg-white px-3 outline-none focus:shadow-[inset_0_0_0_1px_#07c160]"
        autocomplete="off"
        placeholder="发消息"
      >
      <button class="h-10 rounded bg-[#07c160] px-4 text-white" type="submit">
        发送
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat-message__bubble {
  position: relative;
  color: #111;
  word-break: break-word;
}

.chat-message__bubble::before {
  position: absolute;
  top: 12px;
  left: -5px;
  width: 0;
  height: 0;
  content: '';
  border-top: 5px solid transparent;
  border-right: 6px solid #f5f5f5;
  border-bottom: 5px solid transparent;
}

.chat-message--mine .chat-message__bubble::before {
  right: -5px;
  left: auto;
  border-right: 0;
  border-left: 6px solid #95ec69;
}

.chat-message--system .chat-message__bubble::before {
  display: none;
}
</style>
