import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '../views/AdminView.vue'
import AuthView from '../views/AuthView.vue'
import NavView from '../views/NavView.vue'
import UserView from '../views/UserView.vue'

const routes = [
  { path: '/', name: 'about', component: NavView },
  { path: '/auth', name: 'auth', component: AuthView },
  { path: '/user', name: 'user', component: UserView, meta: { requiresAuth: true } },
  { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('accessToken')
  if (to.meta.requiresAuth && !hasToken) {
    next('/auth')
  } else {
    next()
  }
})

export default router