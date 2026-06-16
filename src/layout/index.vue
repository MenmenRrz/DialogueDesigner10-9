<template>
  <a-layout class="layout">
    <a-layout-header>
      <div class="left">
        <button class="brand" type="button" @click="router.push('/import')">
          <span class="brand-mark">HD</span>
          <span class="brand-copy">
            <strong>HealthDial Studio</strong>
            <small>AI conversation design</small>
          </span>
        </button>
      </div>
      <div class="right">
        <a-menu :selectedKeys="activatedKey" mode="horizontal">
          <a-menu-item :key="item.key" v-for="item in navList" @click="onGoTo(item)">{{
            item.label
          }}</a-menu-item>
        </a-menu>
        <div class="designer-chip">
          <span class="designer-chip-label">Designer</span>
          <strong v-if="userNameDisplay">{{ userNameDisplay }}</strong>
          <strong v-else>Not set</strong>
          <button type="button" @click="onChangeDesigner">
            {{ userNameDisplay ? 'Change' : 'Set' }}
          </button>
        </div>
      </div>
    </a-layout-header>
    <a-layout-content>
      <router-view></router-view>
    </a-layout-content>
  </a-layout>
</template>

<script name="Layout" lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useDesignerStore } from '@/stores/designer'
import { useRoute, useRouter } from 'vue-router'
import type { MenuItemType } from 'ant-design-vue/es/menu/src/interface'

const appStore = useAppStore()
const designerStore = useDesignerStore()
const route = useRoute()
const router = useRouter()

const { navList } = storeToRefs(appStore)
const { userName } = storeToRefs(designerStore)

const activatedKey = computed(() => {
  return [route.path.slice(1)]
})

const userNameDisplay = computed(() => userName.value.trim())

const onGoTo = (item: MenuItemType) => {
  router.push(`/${item.key}`)
}

const onChangeDesigner = () => {
  window.dispatchEvent(new CustomEvent('healthdial:open-user-name-modal'))
}
</script>

<style lang="scss" scoped>
.layout {
  height: 100vh;
  background: #f4f8fb;

  .ant-layout-header {
    @include flex(flex-start, center);
    height: $layout-header-height;
    padding: 0 22px;
    border-bottom: 1px solid rgba(190, 209, 224, 0.72);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 8px 28px rgba(34, 75, 105, 0.07);
    backdrop-filter: blur(14px);
  }

  .ant-layout-content {
    height: calc(100vh - #{$layout-header-height});
    background:
      radial-gradient(circle at top left, rgba(17, 139, 141, 0.09), transparent 30%),
      linear-gradient(180deg, #f8fbfd 0%, #eef5f7 100%);
  }

  .left {
    @include flex(flex-start, center);
    min-width: 278px;
    height: 100%;

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: left;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0f766e 0%, #0ea5a5 100%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 900;
      box-shadow: 0 10px 20px rgba(15, 118, 110, 0.18);
    }

    .brand-copy {
      display: grid;
      gap: 2px;
      line-height: 1.1;

      strong {
        color: #12343b;
        font-size: 15px;
        font-weight: 850;
      }

      small {
        color: #647b82;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
    }
  }

  .right {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;

    :deep(.ant-menu) {
      min-width: 0;
      border-bottom: 0;
      background: transparent;
      color: #49666d;
      font-weight: 750;
    }

    :deep(.ant-menu-item) {
      display: inline-flex;
      align-items: center;
      height: 42px;
      margin: 0 3px;
      border-radius: 999px;
    }

    :deep(.ant-menu-item::after) {
      display: none;
    }

    :deep(.ant-menu-item-selected) {
      background: #e6f4f1;
      color: #0f766e;
    }

    .designer-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      padding: 0 10px;
      border: 1px solid #d6e8e5;
      border-radius: 999px;
      background: #ffffff;
      color: #49666d;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(35, 85, 94, 0.04);
    }

    .designer-chip-label {
      color: #7a8f94;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .designer-chip strong {
      color: #12343b;
      font-size: 13px;
      font-weight: 850;
    }

    .designer-chip button {
      padding: 0;
      border: 0;
      background: transparent;
      color: #1677ff;
      font: inherit;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }
  }
}
</style>
