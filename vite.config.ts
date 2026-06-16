import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('./', import.meta.url))
  const env = loadEnv(mode, projectRoot, '')

  const normalizeChunkId = (id: string) => id.replaceAll('\\', '/')

  return {
    base: env.VITE_PUBLIC_BASE || '/',
    plugins: [
      vue(),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: false, // css in js
          }),
        ],
      }),
      vueDevTools(),
    ],
    server: {
      open: true,
      proxy: {
        '/api/r2j': {
          target: env.VITE_R2J_PROXY_TARGET || 'http://localhost:18181',
          changeOrigin: true,
          rewrite: (path) =>
            /^\/api\/r2j\/health(?:\/)?$/i.test(path)
              ? path.replace(/^\/api\/r2j/i, '')
              : path.replace(/^\/api\/r2j/i, '/r2j'),
        },
        '/api': {
          target: env.VITE_AI_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://localhost:18180',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: '@use "@/styles/global.scss" as *;',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = normalizeChunkId(id)

            if (!moduleId.includes('node_modules')) {
              return undefined
            }
            if (moduleId.includes('/@antv/')) {
              return 'vendor-x6'
            }
            if (moduleId.includes('/@ant-design/icons-vue/')) {
              return 'vendor-antd-icons'
            }
            if (moduleId.includes('/ant-design-vue/')) {
              return 'vendor-antd'
            }
            if (
              moduleId.includes('/vue/') ||
              moduleId.includes('/vue-router/') ||
              moduleId.includes('/pinia/')
            ) {
              return 'vendor-vue'
            }
            if (
              moduleId.includes('/openai/') ||
              moduleId.includes('/axios/')
            ) {
              return 'vendor-api'
            }
            if (
              moduleId.includes('/dagre/') ||
              moduleId.includes('/graphlib/') ||
              moduleId.includes('/lodash')
            ) {
              return 'vendor-graph-utils'
            }
            return 'vendor'
          },
        },
      },
    },
  }
})
