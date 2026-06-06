import { createRouter, createWebHistory } from "vue-router";

import HomePage from "./pages/HomePage.vue";
import LoginPage from "./pages/LoginPage.vue";
import ProfilePage from "./pages/ProfilePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/login", name: "login", component: LoginPage },
    { path: "/profile", name: "profile", component: ProfilePage }
  ]
});
