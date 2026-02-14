<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/issue-289/index',
    'pages/issue-289/object-literal/index',
    'pages/issue-289/map-class/index',
    'pages/issue-289/root-class/index',
    'pages/issue-289/computed-class/index',
    'pages/issue-294/index',
    'pages/issue-297/index',
  ],
})

onLaunch(() => {})
</script>
