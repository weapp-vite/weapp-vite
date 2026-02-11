<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/issue-289/index',
    'pages/issue-294/index',
  ],
})

onLaunch(() => {})
</script>
