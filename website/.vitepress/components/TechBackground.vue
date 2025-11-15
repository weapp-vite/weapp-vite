<script setup lang="ts">
import { useData } from 'vitepress'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  grid?: boolean
  particles?: boolean
  speed?: number
  density?: number
  class?: string
}>(), {
  grid: true,
  particles: true,
  speed: 0.2,
  density: 0.7,
})

// Simple animated background: subtle scanning grid + floating brand-tinted particles
const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let particles: { x: number, y: number, vx: number, vy: number, r: number }[] = []
const { isDark } = useData()

function getColors() {
  const root = document.documentElement
  const styles = getComputedStyle(root)
  // fallbacks if CSS vars missing
  const brand1 = styles.getPropertyValue('--vp-c-brand-1').trim() || '#2BA245'
  const brand2 = styles.getPropertyValue('--vp-c-brand-2').trim() || '#95EC69'
  const text = styles.getPropertyValue('--vp-c-text-1').trim() || 'rgba(255,255,255,0.8)'
  const bg = styles.getPropertyValue('--vp-c-bg').trim() || '#0b0f0c'
  const isDark = root.classList.contains('dark')
  return { brand1, brand2, text, bg, isDark }
}

function initParticles(w: number, h: number) {
  const count = Math.max(12, Math.floor((w * h) / 120000) * (props.density ?? 1))
  particles = Array.from({ length: count }).map(() => {
    const r = Math.random() * 1.8 + 0.6
    const speed = (Math.random() * 0.4 + 0.2) * (props.speed ?? 0.2)
    const dir = Math.random() * Math.PI * 2
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      r,
    }
  })
}

function resize() {
  const el = canvas.value
  if (!el) {
    return
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = el.getBoundingClientRect()
  el.width = Math.floor(rect.width * dpr)
  el.height = Math.floor(rect.height * dpr)
  el.style.setProperty('--_dpr', String(dpr))
  const ctx = el.getContext('2d')
  if (!ctx) {
    return
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  initParticles(rect.width, rect.height)
}

function loop(start = performance.now()) {
  const el = canvas.value
  if (!el) {
    return
  }
  const ctx = el.getContext('2d')
  if (!ctx) {
    return
  }
  const rect = el.getBoundingClientRect()
  const { brand1, brand2, isDark } = getColors()
  const w = rect.width
  const h = rect.height
  ctx.clearRect(0, 0, w, h)

  // background subtle vignette
  const grad = ctx.createRadialGradient(w * 0.5, h * -0.1, 0, w * 0.5, h * -0.1, Math.max(w, h))
  grad.addColorStop(0, isDark ? 'rgba(30, 60, 40, 0.35)' : 'rgba(120, 200, 140, 0.18)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const t = (performance.now() - start) / 1000

  // scanning grid
  if (props.grid) {
    const step = 28
    const oy = (t * 30 * (props.speed ?? 0.2)) % step
    ctx.save()
    ctx.globalAlpha = isDark ? 0.18 : 0.12
    ctx.lineWidth = 1
    ctx.strokeStyle = isDark ? 'rgba(120, 240, 160, 0.5)' : 'rgba(30, 90, 45, 0.5)'
    for (let y = -step + oy; y < h + step; y += step) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    const ox = (t * 18 * (props.speed ?? 0.2)) % step
    for (let x = -step + ox; x < w + step; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.restore()
  }

  // brand sweep
  ctx.save()
  const sweepY = (Math.sin(t * 0.8) * 0.5 + 0.5) * h
  const g = ctx.createLinearGradient(0, sweepY - 120, 0, sweepY + 120)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.5, isDark ? `${brand2}33` : `${brand1}33`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // particles
  if (props.particles) {
    ctx.save()
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < -10) {
        p.x = w + 10
      }
      if (p.x > w + 10) {
        p.x = -10
      }
      if (p.y < -10) {
        p.y = h + 10
      }
      if (p.y > h + 10) {
        p.y = -10
      }
      ctx.beginPath()
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30)
      glow.addColorStop(0, isDark ? `${brand2}bb` : `${brand1}aa`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  raf = requestAnimationFrame(loop.bind(null, start))
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize, { passive: true })
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})

watch(
  () => [props.speed, props.density, props.grid, props.particles],
  () => {
    resize()
  },
)

// When theme toggles (light <-> dark), VitePress updates class on <html>.
// We re-measure and restart loop to avoid stale canvas size/alpha causing
// the sweep/grid to appear "stopped" until a hard refresh.
watch(
  () => isDark.value,
  () => {
    // give CSS variables a tick to settle (theme-transition plugin)
    cancelAnimationFrame(raf)
    raf = 0
    // next frame: resize and restart animation baseline
    requestAnimationFrame(() => {
      resize()
      raf = requestAnimationFrame(() => loop())
    })
  },
)
</script>

<template>
  <div class="wv-tech-bg" :class="props.class">
    <canvas ref="canvas" class="absolute inset-0 w-full h-full" />
  </div>
  <!-- Keep this component as pure decoration -->
</template>

<style scoped>
.wv-tech-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;

  /* subtle noise t
   o add texture without images */
  background-image:
    radial-gradient(circle at 25% 15%, rgb(255 255 255 / 4%), transparent 40%),
    radial-gradient(circle at 75% 8%, rgb(255 255 255 / 3%), transparent 35%);
}
</style>
