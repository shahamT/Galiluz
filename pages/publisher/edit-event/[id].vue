<script setup>
const route = useRoute()
await navigateTo(`/publisher/events/edit/${route.params.id}`, { replace: true })
</script>
