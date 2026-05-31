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
    <button v-if="!RegisterMode" @click="RegisterMode = !RegisterMode">
        Переключить на регистрацию</button>
    <button v-if="RegisterMode" @click="RegisterMode = !RegisterMode">
        Переключить на вход</button>
    <form v-if="!RegisterMode" @submit.prevent="handleSubmit">
        <input v-model="form.username" type="text" placeholder="Юзернейм">
        <input v-model="form.password" type="password" placeholder="Пароль">
        <button type="submit">Войти</button>
    </form>
    <form v-if="RegisterMode" @submit.prevent="handleSubmit">
        <input v-model="form.username" type="text" placeholder="Юзернейм">
        <input v-model="form.password" type="password" placeholder="Пароль">
        <input v-model="form.confirmPassword" type="password" placeholder="Подтверждение пароля">
        <button type="submit">Регистрация</button>
    </form>
    <p v-if="error">{{ error }}: {{ errorDiscribe }}</p>
</template>

<style scoped>

</style>