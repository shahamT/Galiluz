<template><div /></template>

<script setup>
definePageMeta({ middleware: 'auth' })
await navigateTo('/admin/dashboard', { replace: true })
</script>
