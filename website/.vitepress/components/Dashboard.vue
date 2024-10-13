<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { GridStack } from 'gridstack'
import { onMounted, ref } from 'vue'
import Echart from './Echart.vue'
import IceTable from './IceTable.vue'
import 'gridstack/dist/gridstack.min.css'

// const { GridStack } = pkg
const pieOption = ref<EChartsOption>({
  backgroundColor: 'transparent',
  title: {
    text: 'Traffic Sources',
    left: 'center',
  },
  tooltip: {
    trigger: 'item',
    formatter: '{a} <br/>{b} : {c} ({d}%)',
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    data: ['Direct', 'Email', 'Ad Networks', 'Video Ads', 'Search Engines'],
  },
  series: [
    {
      name: 'Traffic Sources',
      type: 'pie',
      radius: '55%',
      center: ['50%', '60%'],
      data: [
        { value: 335, name: 'Direct' },
        { value: 310, name: 'Email' },
        { value: 234, name: 'Ad Networks' },
        { value: 135, name: 'Video Ads' },
        { value: 1548, name: 'Search Engines' },
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
  ],
})

const lineOption = ref<EChartsOption>({
  backgroundColor: 'transparent',
  title: {
    // text: 'Stacked Area Chart',
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      label: {
        backgroundColor: '#6a7985',
      },
    },
  },
  legend: {
    data: ['Email', 'Union Ads', 'Video Ads', 'Direct', 'Search Engine'],
  },
  toolbox: {
    feature: {
      saveAsImage: {},
    },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true,
  },
  xAxis: [
    {
      type: 'category',
      boundaryGap: false,
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  ],
  yAxis: [
    {
      type: 'value',
    },
  ],
  series: [
    {
      name: 'Email',
      type: 'line',
      stack: 'Total',
      areaStyle: {},
      emphasis: {
        focus: 'series',
      },
      data: [120, 132, 101, 134, 90, 230, 210],
    },
    {
      name: 'Union Ads',
      type: 'line',
      stack: 'Total',
      areaStyle: {},
      emphasis: {
        focus: 'series',
      },
      data: [220, 182, 191, 234, 290, 330, 310],
    },
    {
      name: 'Video Ads',
      type: 'line',
      stack: 'Total',
      areaStyle: {},
      emphasis: {
        focus: 'series',
      },
      data: [150, 232, 201, 154, 190, 330, 410],
    },
    {
      name: 'Direct',
      type: 'line',
      stack: 'Total',
      areaStyle: {},
      emphasis: {
        focus: 'series',
      },
      data: [320, 332, 301, 334, 390, 330, 320],
    },
    {
      name: 'Search Engine',
      type: 'line',
      stack: 'Total',
      label: {
        show: true,
        position: 'top',
      },
      areaStyle: {},
      emphasis: {
        focus: 'series',
      },
      data: [820, 932, 901, 934, 1290, 1330, 1320],
    },
  ],
})
const labelRight = {
  position: 'right',
} as const

const barOption = ref<EChartsOption>({
  backgroundColor: 'transparent',
  title: {
    // text: 'Bar Chart with Negative Value',
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
  },
  grid: {
    top: 30,
    bottom: 30,
  },
  xAxis: {
    type: 'value',
    position: 'top',
    splitLine: {
      lineStyle: {
        type: 'dashed',
      },
    },
  },
  yAxis: {
    type: 'category',
    axisLine: { show: false },
    axisLabel: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    data: [
      'ten',
      'nine',
      'eight',
      'seven',
      'six',
      'five',
      'four',
      'three',
      'two',
      'one',
    ],
  },
  series: [
    {
      name: 'Cost',
      type: 'bar',
      stack: 'Total',
      label: {
        show: true,
        formatter: '{b}',
      },
      data: [
        { value: -0.07, label: labelRight },
        { value: -0.09, label: labelRight },
        0.2,
        0.44,
        { value: -0.23, label: labelRight },
        0.08,
        { value: -0.17, label: labelRight },
        0.47,
        { value: -0.36, label: labelRight },
        0.18,
      ],
    },
  ],
})

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
  // GridStack.prototype.printCount = function () {
  //   console.log(`grid has ${this.engine.nodes.length} items`)
  // }

  gridRef.value = GridStack.init()

  // grid.printCount()
})
</script>

<template>
  <div class="container mx-auto py-8">
    <div class="rounded-lg border bg-gray-100 p-1 dark:bg-[#262727]">
      <div class="grid-stack">
        <div
          v-for="(item) in items" :key="item.content" :gs-x="item.x" :gs-y="item.y" :gs-w="item.w"
          :gs-h="item.h" class="grid-stack-item"
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
