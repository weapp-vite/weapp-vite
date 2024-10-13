---
layout: page
---

<script setup lang="ts">
import { defineClientComponent } from 'vitepress'
const Dashboard = defineClientComponent(()=>{
  return import('./.vitepress/components/Dashboard.vue')
})
// import Dashboard from './.vitepress/components/Dashboard.vue'
</script>

<ClientOnly>
<Dashboard></Dashboard>
</ClientOnly>
