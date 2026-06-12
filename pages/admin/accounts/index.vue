<template>
  <AdminPlaceholderPage title="חשבונות ומפרסמים" description="ניהול החשבונות והמפרסמים המשויכים אליהם." />
</template>

<script setup>
defineOptions({ name: 'AdminAccounts' })
definePageMeta({ middleware: 'auth' })
useHead({ title: 'חשבונות ומפרסמים | ניהול | גלילו"ז' })
</script>
