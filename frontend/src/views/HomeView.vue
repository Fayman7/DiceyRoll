<script setup>
import { ref, onMounted, computed } from 'vue'
import AppMenu from '../components/AppMenu.vue'
import { rollDice, fetchDiceHistory } from '../api'

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
const isAuthenticated = computed(() => !!localStorage.getItem('accessToken'))
const history = ref([])
const lastRoll = ref(null)
const loading = ref(false)
const errorMessage = ref('')

async function loadHistory() {
    if (!isAuthenticated.value) return
    try {
        history.value = await fetchDiceHistory()
    } catch (err) {
        errorMessage.value = err.message
    }
}

async function onRoll(diceType) {
    loading.value = true
    errorMessage.value = ''
    try {
        lastRoll.value = await rollDice(diceType)
        await loadHistory()
    } catch (err) {
        errorMessage.value = err.message
    } finally {
        loading.value = false
    }
}

onMounted(loadHistory)
</script>

<template>
    <div class="page">
        <h1>Главная</h1>
        <AppMenu />

        <section class="card dice-section">
            <h2>Игральные кости</h2>
            <div class="dice-buttons">
                <button
                    v-for="d in DICE_TYPES"
                    :key="d"
                    type="button"
                    class="label"
                    :disabled="loading"
                    @click="onRoll(d)"
                >
                    {{ d.toUpperCase() }}
                </button>
            </div>
            <p v-if="lastRoll" class="last-roll">
                Последний бросок: {{ lastRoll.dice_type }} → {{ lastRoll.result }}
            </p>
            <template v-if="isAuthenticated">
                <h3>История бросков</h3>
                <ul v-if="history.length" class="history">
                    <li v-for="roll in history" :key="roll.id">
                        {{ roll.dice_type }}: {{ roll.result }}
                    </li>
                </ul>
                <p v-else class="muted">Пока нет бросков</p>
            </template>
            <p v-else class="muted">История бросков доступна после входа</p>
        </section>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>
</template>

<style scoped>
.dice-section {
    width: 100%;
    max-width: 560px;
}
.dice-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
    margin: 12px 0;
}
.history {
    list-style: none;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
}
.history li {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
}
.last-roll {
    font-weight: bold;
    margin: 4px 0 10px;
}
</style>
