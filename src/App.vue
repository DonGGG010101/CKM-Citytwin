<script setup>
import { ref } from 'vue'
import SingleDemo from './components/SingleDemo.vue'
import MultiDemo from './components/MultiDemo.vue'
const page=ref('single')
</script>
<template>
  <SingleDemo v-if="page==='single'" @next="page='multi'" />
  <MultiDemo v-else @back="page='single'" />
</template>
