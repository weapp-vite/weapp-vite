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
    'pages/issue-297-setup-method-calls/index',
    'pages/issue-300/index',
    'pages/issue-302/index',
    'pages/issue-309/index',
    'pages/issue-309-created/index',
    'pages/issue-312/index',
    'pages/issue-316/index',
    'pages/issue-318/index',
    'pages/issue-320/index',
    'pages/issue-322/index',
    'pages/issue-328/index',
  ],
  subPackages: [
    {
      root: 'subpackages/item',
      pages: ['index'],
    },
    {
      root: 'subpackages/user',
      pages: ['index'],
    },
  ],
})

onLaunch(() => {})
</script>
