<template>
  <a-layout class="layout">
    <a-layout-header>
      <div class="left">
        <div class="title"></div>
      </div>
      <div class="right">
        <a-menu theme="dark" v-model:selectedKeys="activatedKey" mode="horizontal">
          <a-menu-item :key="item.key" v-for="item in navList" @click="onGoTo(item)">{{
            item.label
          }}</a-menu-item>
        </a-menu>
      </div>
    </a-layout-header>
    <a-layout-content>
      <router-view></router-view>
    </a-layout-content>
  </a-layout>
</template>

<script name="Layout" lang="ts" setup>
import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useRoute, useRouter } from 'vue-router'
import type { MenuItemType } from 'ant-design-vue/es/menu/src/interface'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

const { navList } = storeToRefs(appStore)

const activatedKey = computed(() => {
  return [route.path.slice(1)]
})

watch(
  () => route.query,
  () => {
    console.log(route.path)
  },
  {
    immediate: true,
  },
)

const onGoTo = (item: MenuItemType) => {
  router.push(`/${item.key}`)
}
</script>

<style lang="scss" scoped>
.layout {
  height: 100vh;

  .ant-layout-header {
    @include flex(flex-start, center);

    padding: 0;
  }

  .ant-layout-content {
    height: calc(100vh - #{$layout-header-height});
  }

  .left {
    @include flex(center, center);
    width: 64px;
    height: 100%;
    background-color: #fff;
    cursor: pointer;

    .title {
      font-size: 18px;
    }
  }
}
</style>
