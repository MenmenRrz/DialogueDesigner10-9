import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MenuItemType } from 'ant-design-vue/es/menu/src/interface'
import { OPENAI_API_KEY } from '@/config/api'

export const useAppStore = defineStore('app', () => {
  const apiKey = ref(OPENAI_API_KEY.trim())

  const navList = ref<MenuItemType[]>([
    {
      label: 'Import File',
      key: 'import',
    },
    {
      label: 'Convert to Dialogue',
      key: 'convert',
    },
  ])

  return {
    apiKey,
    navList,
  }
})
