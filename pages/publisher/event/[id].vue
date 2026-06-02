<script setup>
const route = useRoute()
await navigateTo(`/publisher/events/${route.params.id}`, { replace: true })
</script>
