<script setup lang="ts">
import { clearToken } from "../lib/api";

const mobileTabs = [
  { label: "首页", to: "/" },
  { label: "资讯", to: "/news" },
  { label: "广场", to: "/plaza" },
  { label: "个人", to: "/profile" }
];

function logout() {
  clearToken();
  window.location.href = "/login";
}
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav data-testid="desktop-navigation" class="mx-auto hidden max-w-5xl items-center justify-between px-4 py-3 sm:flex">
        <RouterLink to="/" class="text-lg font-bold text-blue-700">GradCheck</RouterLink>
        <div class="flex items-center gap-3 text-sm font-medium text-slate-600">
          <RouterLink to="/" class="hover:text-blue-700">首页</RouterLink>
          <RouterLink to="/profile" class="hover:text-blue-700">个人信息</RouterLink>
          <button class="rounded-full bg-slate-900 px-3 py-1.5 text-white" type="button" @click="logout">
            退出
          </button>
        </div>
      </nav>

      <nav data-testid="mobile-navigation" class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:hidden">
        <RouterLink to="/" class="text-lg font-bold text-blue-700">GradCheck</RouterLink>
        <RouterLink
          to="/"
          data-testid="mobile-graduation-prompt"
          class="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700"
        >
          你现在能毕业吗？
        </RouterLink>
      </nav>
    </header>

    <main class="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pb-6">
      <slot />
    </main>

    <nav
      data-testid="mobile-bottom-navigation"
      class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 text-xs font-medium text-slate-600 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
    >
      <RouterLink
        v-for="tab in mobileTabs"
        :key="tab.label"
        :to="tab.to"
        class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 hover:bg-blue-50 hover:text-blue-700"
      >
        <span>{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
