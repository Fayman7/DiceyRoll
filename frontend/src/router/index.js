import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '../views/AdminView.vue'
import AuthView from '../views/AuthView.vue'
import HomeView from '../views/HomeView.vue'
import UserView from '../views/UserView.vue'
import ImagesView from '../views/ImagesView.vue'
import GameView from '../views/GameView.vue'
import RandomItemView from '../views/RandomItemView.vue'

function parseJwtAdmin() {
  const token = localStorage.getItem('accessToken')
  if (!token) return false
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return payload.isAdmin === true
  } catch {
    return false
  }
}

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/auth', name: 'auth', component: AuthView },
  { path: '/user', name: 'user', component: UserView, meta: { requiresAuth: true } },
  { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/images', name: 'images', component: ImagesView, meta: { requiresAuth: true } },
  { path: '/game', name: 'game', component: GameView, meta: { requiresAuth: true } },
  { path: '/random-items', name: 'random-items', component: RandomItemView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('accessToken')
  if (to.meta.requiresAuth && !hasToken) {
    next('/auth')
  } else if (to.meta.requiresAdmin && !parseJwtAdmin()) {
    next('/')
  } else {
    next()
  }
})

export default router
