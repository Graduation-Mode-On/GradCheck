<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import { login, register, setToken } from "../lib/api";
import { loginSchema, profileSchema } from "../schemas/auth";

const router = useRouter();
const mode = ref<"login" | "register">("login");
const form = reactive({
  email: "",
  password: "",
  displayName: "",
  college: "",
  major: "",
  grade: new Date().getFullYear(),
  gpaGoal: "2.00"
});
const errorMessage = ref("");

const submitLabel = computed(() => (mode.value === "login" ? "登录" : "注册并进入"));

const mutation = useMutation({
  mutationFn: async () => {
    if (mode.value === "login") {
      return login(loginSchema.parse({ email: form.email, password: form.password }));
    }

    const profile = profileSchema.parse({
      displayName: form.displayName,
      college: form.college,
      major: form.major,
      grade: form.grade,
      gpaGoal: form.gpaGoal
    });

    return register(
      loginSchema.extend({ profile: profileSchema }).parse({
        email: form.email,
        password: form.password,
        profile
      })
    );
  },
  onSuccess: async (response) => {
    setToken(response.token);
    await router.push("/");
  },
  onError: (error) => {
    if (error instanceof ZodError) {
      errorMessage.value = error.issues[0]?.message ?? "表单信息不完整";
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : "请求失败";
  }
});

function submit() {
  errorMessage.value = "";
  mutation.mutate();
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
    <section class="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
      <p class="text-sm font-semibold text-blue-700">GradCheck</p>
      <h1 class="mt-2 text-2xl font-bold text-slate-900">{{ submitLabel }}</h1>
      <p class="mt-2 text-sm text-slate-600">先建立账号和个人信息，后续毕业进度模块会复用这些基础资料。</p>

      <div class="mt-5 grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          class="rounded-full px-3 py-2"
          :class="mode === 'login' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-2"
          :class="mode === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block text-sm font-medium text-slate-700">
          邮箱
          <input v-model="form.email" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" type="email" />
        </label>
        <label class="block text-sm font-medium text-slate-700">
          密码
          <input
            v-model="form.password"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            type="password"
          />
        </label>

        <div v-if="mode === 'register'" class="space-y-4 border-t border-slate-100 pt-4">
          <label class="block text-sm font-medium text-slate-700">
            显示名称
            <input v-model="form.displayName" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            学院
            <input v-model="form.college" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            专业
            <input v-model="form.major" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-slate-700">
              年级
              <input
                v-model.number="form.grade"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                type="number"
              />
            </label>
            <label class="block text-sm font-medium text-slate-700">
              目标 GPA
              <input v-model="form.gpaGoal" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
          </div>
        </div>

        <p v-if="errorMessage" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>

        <button
          class="w-full rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          type="submit"
          :disabled="mutation.isPending.value"
        >
          {{ mutation.isPending.value ? "提交中..." : submitLabel }}
        </button>
      </form>
    </section>
  </main>
</template>
