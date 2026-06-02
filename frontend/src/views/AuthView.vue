<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter();
const RegisterMode = ref(false);
const form = ref({
    username: '',
    password: '',
    confirmPassword: ''
});
const error = ref('');
const errorDiscribe = ref('');

const handleSubmit = async () => {
    if (!RegisterMode.value) {
        try {
            const response = await fetch('http://localhost:4242/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.value.username,
                    password: form.value.password
                })
            });

            if (response.ok) {
                const userData = await response.json();
                localStorage.setItem('accessToken', userData.accessToken);
                localStorage.setItem('refreshToken', userData.refreshToken);
                localStorage.setItem('userId', userData.id);
                router.push('/');
            }
            else {
                const errorData = await response.json();
                errorDiscribe.value = errorData.message;
                throw new Error('Ошибка входа');
            }
        } catch (err) {
            console.error(err);
            error.value = err.message; 
        }
    } else {
        if (form.value.password && form.value.confirmPassword) {
            if (form.value.password === form.value.confirmPassword) {
                try {
                    const response = await fetch('http://localhost:4242/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: form.value.username,
                            password: form.value.password
                        })
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        localStorage.setItem('accessToken', userData.accessToken);
                        localStorage.setItem('refreshToken', userData.refreshToken);
                        localStorage.setItem('userId', userData.id);
                        router.push('/');
                    }
                    else {
                        const errorData = await response.json();
                        errorDiscribe.value = errorData.message;
                        throw new Error('Ошибка регистрации');
                    }
                } catch (err) {
                    console.error(err);
                    error.value = err.message;
                }
            }
            else {
                error.value = 'Ошибка регистрации';
                errorDiscribe.value = 'Подтверждение пароля не совпадает c паролем';
            }
        }
        else {
            error.value = 'Ошибка регистрации';
            errorDiscribe.value = 'Недостаточно данных для регистрации';
        }
    }
}
</script>

<template>
    <div class="page">
        <h1>{{ RegisterMode ? 'Регистрация' : 'Вход' }}</h1>
        <div class="card auth-card">
            <button type="button" class="label" @click="RegisterMode = !RegisterMode">
                {{ RegisterMode ? 'Переключить на вход' : 'Переключить на регистрацию' }}
            </button>

            <form class="auth-form" @submit.prevent="handleSubmit">
                <input v-model="form.username" type="text" placeholder="Юзернейм" class="input">
                <input v-model="form.password" type="password" placeholder="Пароль" class="input">
                <input
                    v-if="RegisterMode"
                    v-model="form.confirmPassword"
                    type="password"
                    placeholder="Подтверждение пароля"
                    class="input"
                >
                <button type="submit" class="label">
                    {{ RegisterMode ? 'Регистрация' : 'Войти' }}
                </button>
            </form>
        </div>
        <p v-if="error" class="error">{{ error }}: {{ errorDiscribe }}</p>
    </div>
</template>

<style scoped>
.auth-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 380px;
}
.auth-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
</style>