<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch, logout } from '../api'

const username = ref('')
const update = ref(false)

onMounted(async () => {
    try {
        const response = await apiFetch(`http://localhost:4242/me`)

        if (response.ok) {
            const userData = await response.json()
            username.value = userData.username
        } else {
            throw new Error('Не удалось получить данные пользователя')
        }
    } catch (err) {
        console.error(err)
    }
})

const updating = async () => {
    update.value = !update.value
}
const deleteUser = async () => {
    try {
        const response = await apiFetch('http://localhost:4242/me', {
            method: 'DELETE'
        })

        if (response.ok) {
            logout()
        }
        else {
            throw new Error('Не удалось удалить пользователя')
        }
    } catch (err) {
        console.error(err)
    }
}
</script>

<template>
    <div id="sector">
        <h1>Профиль пользователя</h1>
        <p class="label">Юзернейм: {{ username }}</p>
        <button @click="updating" class="label">{{ update ? 'Обновить <' : 'Обновить >' }}</button>
        <button @click="deleteUser" class="label">Удалить</button>
    </div>
</template>

<style scoped>
#sector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}
.label {
    border: 1px solid #09001b;
    border-radius: 20px;
    background: #0d002799;
    padding: 10px;
}
</style>