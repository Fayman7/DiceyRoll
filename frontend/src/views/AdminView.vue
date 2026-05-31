<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../api'

const username = ref('')
const usersList = ref([])

onMounted(async () => {
    try {
        const response = await apiFetch(`http://localhost:4242/me`)

        if (response.ok) {
            const userData = await response.json()
            username.value = userData.username
        }
        else {
            throw new Error('Не удалось получить данные пользователя')
        }
    } catch (err) {
        console.error(err)
    };

    try {
        const response = await apiFetch('http://localhost:4242/users')

        if (response.ok) {
            const usersListData = await response.json()
            usersList.value = usersListData
        }
        else {
            throw new Error('Не удалось получить данные о всех пользователях')
        }
    } catch (err) {
        console.error(err)
    }
})
</script>

<template>
    <h1>Панель администратора</h1>
    <p>Юзернейм: {{ username }}</p>
    <h2>Список пользователей</h2>
    <p v-for="user in usersList" :key="user.id">{{ user.username }}</p>
</template>

<style scoped>

</style>