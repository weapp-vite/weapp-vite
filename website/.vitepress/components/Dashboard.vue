<script setup lang="ts">
import { GridStack } from 'gridstack'
import { onMounted, ref } from 'vue'
import Echart from './Echart.vue'
import IceTable from './IceTable.vue'
import { barOption, lineOption, pieOption } from './mock'
import 'gridstack/dist/gridstack.min.css'

// https://github.com/gridstack/gridstack.js/issues/2115
// https://github.com/gridstack/gridstack.js/blob/67d08c665910919a036a9b4ac9099aa51b773348/src/gridstack-engine.ts#L546
// 现在更改了实现方式变成了 id 匹配，所以不存在这个问题了
const items = ref([
  { x: 0, y: 0, w: 2, h: 2, content: 'icebreaker' },
  { x: 2, y: 0, w: 2, h: 2, content: 'weapp-tailwindcss' },
  { x: 4, y: 0, w: 2, h: 2, content: 'weapp-vite' },
  { x: 6, y: 0, w: 4, h: 4, content: 'chart', option: pieOption },
  { x: 10, y: 0, w: 2, h: 6, content: 'chart', option: barOption },
  { w: 2, h: 4, content: 'chart', option: pieOption },
  { w: 4, h: 2, content: 'chart', option: lineOption },
  { x: 4, y: 4, w: 6, h: 2, content: 'table' },
])
const gridRef = ref<GridStack>()
onMounted(() => {
  gridRef.value = GridStack.init()
})

// function add() {

// }

// function removeLastItem() {
//   items.value.splice(items.value.length - 1, 1)
// }
</script>

<template>
  <div class="container mx-auto py-8">
    <!-- <el-button @click="add">
      add
    </el-button>
    <el-button @click="removeLastItem">
      remove last item
    </el-button> -->
    <div class="rounded-lg border bg-gray-100 p-1 dark:bg-[#262727]">
      <div class="grid-stack">
        <div
          v-for="(item) in items" :key="item.content" :gs-x="item.x" :gs-y="item.y" :gs-w="item.w" :gs-h="item.h"
          class="grid-stack-item"
        >
          <div class="grid-stack-item-content">
            <template v-if="item.content === 'icebreaker'">
              <div class="flex h-full flex-col items-center justify-center p-4">
                <img class="mb-2 h-40 rounded-full" src="/icebreaker.jpg">
                <a
                  class="bg-gradient-to-r from-green-400 to-sky-400 bg-clip-text text-xl font-extrabold text-transparent underline"
                  href="https://github.com/sonofmagic" rel="nofollow" target="_blank"
                >
                  ice breaker
                </a>
              </div>
            </template>
            <template v-else-if="item.content === 'weapp-tailwindcss'">
              <div class="flex h-full flex-col items-center justify-center p-4">
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
            <template v-else-if="item.content === 'weapp-vite'">
              <div class="flex h-full flex-col items-center justify-center p-4">
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
              <Echart :option="item.option" />
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
