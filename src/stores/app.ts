import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MenuItemType } from 'ant-design-vue/es/menu/src/interface'

export const useAppStore = defineStore('app', () => {
  const navList = ref<MenuItemType[]>([
    {
      label: 'Create',
      key: 'import',
    },
    {
      label: 'Design Studio',
      key: 'convert',
    },
  ])

  return {
    navList,
  }
})
