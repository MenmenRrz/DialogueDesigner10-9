<template>
  <div class="option-node">
    <span class="name" v-if="status === 'view'" :title="title" @dblclick="onEditOptionName()">{{
      title
    }}</span>
    <a-input
      v-model:value="title"
      v-if="status === 'edit'"
      @pressEnter="onEditOk()"
      @blur="onEditOk()"
    />
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  node?: any
  graph?: any
}>()

const title = ref('')
const status = ref('')

const getNode: any = inject('getNode')
const nodeRef = ref<any>(props.node ?? null)

const resolveNode = () => {
  if (nodeRef.value) {
    return nodeRef.value
  }
  nodeRef.value = props.node ?? (typeof getNode === 'function' ? getNode() : getNode)
  return nodeRef.value
}

watch(
  () => props.node,
  (val) => {
    if (val) {
      nodeRef.value = val
    }
  },
)

const onEditOptionName = () => {
  status.value = 'edit'
}

const onEditOk = () => {
  status.value = 'view'
  const node = resolveNode()
  node.setData({
    title: title.value,
  })
}

onMounted(() => {
  const node = resolveNode()
  title.value = node.data.title
  status.value = node.data.status
})
</script>

<style lang="scss" scoped>
.option-node {
  @include flex(flex-start, center);
  height: 36px;
  padding: 5px;
  background: #4096ff;
  margin: 3px 0;
  border-radius: 3px;

  & > .name {
    color: #fff;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
  }
}
</style>
