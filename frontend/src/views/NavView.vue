<script setup>
import { ref, onMounted, computed } from 'vue'
import { logout } from '../api';

const isAdmin = ref(false)
const isAuthenticated = computed(() => !!localStorage.getItem('accessToken'))

function parseJwt(token) {
    if (!token) return null
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (err) {
        return null
    }
}

onMounted(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
        const decoded = parseJwt(token)
        if (decoded && decoded.isAdmin) {
            isAdmin.value = true
        }
    }
})
</script>

<template>
    <nav>
        <h1>Навигация</h1>
        <RouterLink to="/user" class="label">Профиль</RouterLink>
        <RouterLink v-if="isAdmin" to="/admin" class="label">Панель админа</RouterLink>
        <RouterLink @click="logout" to="/auth" class="label">{{ isAuthenticated ? 'Выйти' : 'Вход' }}</RouterLink>
    </nav>
</template>

<style scoped>
nav {
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