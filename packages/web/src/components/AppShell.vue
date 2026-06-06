<script setup lang="ts">
import { clearToken } from "../lib/api";

const mobileTabs = [
  {
    label: "首页",
    to: "/",
    iconPath:
      "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z"
  },
  {
    label: "资讯",
    to: "/news",
    iconPath:
      "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2H6a2 2 0 0 1-2-2V5Zm4 3h8M8 12h6"
  },
  {
    label: "广场",
    to: "/plaza",
    iconPath:
      "M4 7h16M6 7l1 13h10l1-13M9 7V5a3 3 0 0 1 6 0v2M9 12h6"
  },
  {
    label: "个人",
    to: "/profile",
    iconPath:
      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"
  }
];

function logout() {
  clearToken();
  window.location.href = "/login";
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-[var(--tommy-text)]">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav data-testid="desktop-navigation" class="mx-auto hidden max-w-5xl items-center justify-between px-4 py-3 sm:flex">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold text-[var(--tommy-primary)]">
          <img src="/logo.png" alt="GradCheck logo" class="h-8 w-8 rounded-lg shadow-sm" />
          <span>GradCheck</span>
        </RouterLink>
        <div class="flex items-center gap-3 text-sm font-medium text-[var(--tommy-text-secondary)]">
          <RouterLink to="/" class="hover:text-[var(--tommy-primary)]">首页</RouterLink>
          <RouterLink to="/profile" class="hover:text-[var(--tommy-primary)]">个人信息</RouterLink>
          <button class="rounded-full bg-slate-900 px-3 py-1.5 text-white" type="button" @click="logout">
            退出
          </button>
        </div>
      </nav>

      <nav data-testid="mobile-navigation" class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:hidden">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold text-[var(--tommy-primary)]">
          <img src="/logo.png" alt="GradCheck logo" class="h-7 w-7 rounded-lg shadow-sm" />
          <span>GradCheck</span>
        </RouterLink>
        <RouterLink
          to="/"
          data-testid="mobile-graduation-prompt"
          class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1.5 text-sm font-semibold text-[var(--tommy-info)]"
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
      class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 text-xs font-medium text-[var(--tommy-text-secondary)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
    >
      <RouterLink
        v-for="tab in mobileTabs"
        :key="tab.label"
        :to="tab.to"
        class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition hover:bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)] hover:text-[var(--tommy-primary)]"
        active-class="bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] text-[var(--tommy-primary)]"
        exact-active-class="bg-[color-mix(in_srgb,var(--tommy-primary)_16%,white)] text-[var(--tommy-primary)]"
      >
        <svg
          data-testid="mobile-tab-icon"
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          aria-hidden="true"
        >
          <path :d="tab.iconPath" />
        </svg>
        <span>{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
