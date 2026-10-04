import type { EditSequence } from './driver'

export function frameworkPageSource(index: number, revision: number) {
  const marker = `page-${String(index).padStart(4, '0')}-v${String(revision).padStart(4, '0')}`
  return `<script setup>const message = ${JSON.stringify(marker)}</script>\n<template><view class="message">{{ message }}</view></template>\n<style>.message { color: rgb(12, 34, 56); }</style>`
}

/** 512 个真实框架 SFC 入口始终留在同一宿主中；每轮仍由既有 driver 创建独立基线。 */
export function createFrameworkResourceSequence(cycles = 14, pages = 512): EditSequence {
  if (!Number.isInteger(cycles) || cycles < 14 || cycles > 120 || !Number.isInteger(pages) || pages < 1 || pages > 512) {
    throw new Error('Framework resources require 14–120 cycles and 1–512 SFC pages')
  }
  const routes = Array.from({ length: pages }, (_, index) => `pages/page-${String(index).padStart(4, '0')}/index`)
  return {
    name: `framework-${pages}-sfc-resource-trend`,
    files: {
      'package.json': '{"name":"framework-resource-sequence","type":"module","dependencies":{"wevu":"workspace:*"}}',
      'project.config.json': '{"miniprogramRoot":"dist","appid":"wxb3d842a4a7e3440d"}',
      'src/app.js': 'App({})',
      'src/app.json': JSON.stringify({ pages: routes }),
      ...Object.fromEntries(routes.map((route, index) => [`src/${route}.vue`, frameworkPageSource(index, 0)])),
    },
    steps: Array.from({ length: cycles }, (_, index) => ({
      name: `continuous full-framework SFC edit ${index + 1}`,
      action: { kind: 'write', file: `src/${routes[0]}.vue`, content: frameworkPageSource(0, index + 1) },
    })),
  }
}
