<template>
  <AdminPlaceholderPage title="כל האירועים" description="ניהול וצפייה בכל האירועים בפלטפורמה." />
</template>

<script setup>
defineOptions({ name: 'AdminEvents' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'אירועים | ניהול | גלילו"ז' })
</script>
