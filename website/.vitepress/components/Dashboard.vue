<script setup lang="ts">
import { GridStack } from 'gridstack'
import { onMounted, ref } from 'vue'
import Echart from './Echart.vue'
import IceTable from './IceTable.vue'
import 'gridstack/dist/gridstack.min.css'

const items = ref([
  { x: 0, y: 0, w: 2, h: 2, content: '1' },
  { x: 2, y: 0, w: 2, h: 2, content: '2' },
  { x: 4, y: 0, w: 2, h: 2, content: '3' },
  { x: 6, y: 0, w: 4, h: 4, content: '4' },
  { x: 10, y: 0, w: 2, h: 6, content: '5' },
  { w: 2, h: 4, content: '6' },
  { w: 4, h: 2, content: '7' },
  { x: 4, y: 4, w: 6, h: 2, content: 'table' },
])

onMounted(() => {
  GridStack.prototype.printCount = function () {
    console.log(`grid has ${this.engine.nodes.length} items`)
  }

  const grid = GridStack.init()

  grid.printCount()
})
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="rounded-lg border bg-gray-100 p-1 dark:bg-[#262727]">
      <div class="grid-stack">
        <div
          v-for="(item, idx) in items" :key="item.content" :gs-x="item.x" :gs-y="item.y" :gs-w="item.w"
          :gs-h="item.h" class="grid-stack-item"
        >
          <div class="grid-stack-item-content">
            <template v-if="idx === 0">
              <div class="flex flex-col items-center justify-center p-4">
                <img class="mb-2 h-40 rounded-full" src="/icebreaker.jpg">
                <a
                  class="bg-gradient-to-r from-green-400 to-sky-400 bg-clip-text text-xl font-extrabold text-transparent underline"
                  href="https://github.com/sonofmagic" rel="nofollow" target="_blank"
                >
                  ice breaker
                </a>
              </div>
            </template>
            <template v-else-if="idx === 1">
              <div class="flex flex-col items-center justify-center p-4">
                <div class="relative mb-2 size-40">
                  <img class="absolute left-6 top-8 w-full" src="/tw-logo.png">
                </div>
                <a
                  class="bg-gradient-to-r from-green-400 to-sky-400 bg-clip-text text-xl font-extrabold text-transparent underline"
                  href="https://tw.icebreaker.top/" rel="nofollow" target="_blank"
                >
                  weapp-tailwindcss
                </a>
              </div>
            </template>
            <template v-else-if="idx === 2">
              <div class="flex flex-col items-center justify-center p-4">
                <img class="mb-2 h-40" src="/logo.png">
                <a
                  class="bg-gradient-to-r from-green-400 to-sky-400 bg-clip-text text-xl font-extrabold text-transparent underline"
                  href="https://vite.icebreaker.top/" rel="nofollow" target="_blank"
                >
                  weapp-vite
                </a>
              </div>
            </template>
            <template v-else-if="item.content === 'table'">
              <IceTable />
            </template>
            <template v-else>
              <Echart />
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.grid-stack-item-content {
  border-radius: 8px;
  @apply bg-white dark:bg-[#141414];
}
</style>
