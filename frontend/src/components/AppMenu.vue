<script setup>
import { ref, onMounted, computed } from 'vue'
import { logout } from '../api'

const isAdmin = ref(false)
const isAuthenticated = computed(() => !!localStorage.getItem('accessToken'))

function parseJwt(token) {
    if (!token) return null
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        )
        return JSON.parse(jsonPayload)
    } catch {
        return null
    }
}

onMounted(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
        const decoded = parseJwt(token)
        if (decoded?.isAdmin) {
            isAdmin.value = true
        }
    }
})
</script>

<template>
    <nav class="app-menu">
        <RouterLink to="/" class="label">Главная</RouterLink>
        <RouterLink to="/random-items" class="label">Случайный предмет</RouterLink>
        <RouterLink v-if="isAuthenticated" to="/images" class="label">Изображения</RouterLink>
        <RouterLink v-if="isAuthenticated" to="/game" class="label">Игра</RouterLink>
        <RouterLink v-if="isAuthenticated" to="/user" class="label">Профиль</RouterLink>
        <RouterLink v-if="isAdmin" to="/admin" class="label">Панель админа</RouterLink>
        <RouterLink @click="logout" to="/auth" class="label">
            {{ isAuthenticated ? 'Выйти' : 'Вход' }}
        </RouterLink>
    </nav>
</template>
