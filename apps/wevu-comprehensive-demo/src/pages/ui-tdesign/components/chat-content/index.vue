<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignChatContentPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-chat-content',
}))

const attachments = ref([{ name: 'demo.png', url: 'https://dummyimage.com/120x120/667eea/ffffff.png&text=TDesign', size: 2048 }])
const chatContent = ref({ type: 'text', data: 'Hello from chat-content' })
const chatThinking = ref({ type: 'text', data: 'thinking...' })
const chatMessageContent = ref([{ type: 'text', data: 'Hello from chat-message' }, { type: 'thinking', data: chatThinking.value }, { type: 'attachment', data: attachments.value }])
const chatListData = ref([{ chatId: 'c1', role: 'assistant', name: 'Assistant', datetime: '12:00', content: [{ type: 'markdown', data: '**TDesign Chat**' }] }, { chatId: 'c2', role: 'user', name: 'User', datetime: '12:01', content: [{ type: 'text', data: 'Hi' }] }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-chat-content
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-chat-actionbar content="t-chat-actionbar" />
      <t-chat-loading text="loading..." />
      <t-chat-markdown content="**t-chat-markdown**" />
      <t-chat-content :content="chatContent" role="assistant" />
      <t-chat-thinking :content="chatThinking" role="assistant" status="pending" />
      <t-chat-message :content="chatMessageContent" role="assistant" name="Assistant" datetime="now" />
      <t-chat-sender />
      <t-chat-list :data="chatListData" />
    </view>
  </view>
</template>
