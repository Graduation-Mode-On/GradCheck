<script setup lang="ts">
import { clearToken } from "../lib/api";

function logout() {
  clearToken();
  window.location.href = "/login";
}
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <RouterLink to="/" class="text-lg font-bold text-blue-700">GradCheck</RouterLink>
        <div class="flex items-center gap-3 text-sm font-medium text-slate-600">
          <RouterLink to="/" class="hover:text-blue-700">首页</RouterLink>
          <RouterLink to="/profile" class="hover:text-blue-700">个人信息</RouterLink>
          <button class="rounded-full bg-slate-900 px-3 py-1.5 text-white" type="button" @click="logout">
            退出
          </button>
        </div>
      </nav>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
