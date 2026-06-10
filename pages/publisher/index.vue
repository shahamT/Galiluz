<template><div /></template>

<script setup>
definePageMeta({ middleware: 'auth' })
await navigateTo('/publisher/dashboard', { replace: true })
</script>
