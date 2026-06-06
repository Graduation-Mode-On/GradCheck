<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import { clearToken, getCurrentUser, getToken, updateProfile } from "../lib/api";
import { profileSchema } from "../schemas/auth";

const router = useRouter();
const queryClient = useQueryClient();
const message = ref("");
const form = reactive({
  displayName: "",
  college: "",
  major: "",
  grade: new Date().getFullYear(),
  gpaGoal: "2.00"
});

if (!getToken()) {
  void router.replace("/login");
}

const { data } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
  enabled: Boolean(getToken())
});

watchEffect(() => {
  const profile = data.value?.user.profile;
  if (!profile) {
    return;
  }

  form.displayName = profile.displayName;
  form.college = profile.college;
  form.major = profile.major;
  form.grade = profile.grade;
  form.gpaGoal = profile.gpaGoal;
});

const mutation = useMutation({
  mutationFn: async () => updateProfile(profileSchema.parse(form)),
  onSuccess: async () => {
    message.value = "个人信息已保存";
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
  },
  onError: (error) => {
    if (error instanceof ZodError) {
      message.value = error.issues[0]?.message ?? "表单信息不完整";
      return;
    }

    message.value = error instanceof Error ? error.message : "保存失败";
  }
});

async function logout() {
  clearToken();
  await router.push("/login");
}
</script>

<template>
  <AppShell>
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">个人信息</h1>
      <p class="mt-2 text-sm text-slate-600">这些字段会作为后续毕业判断、推荐和学院特色要求的基础上下文。</p>

      <form class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="mutation.mutate()">
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

        <div class="sm:col-span-2">
          <p v-if="message" class="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">{{ message }}</p>
          <div class="flex flex-wrap gap-3">
            <button
              class="rounded-xl bg-blue-700 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
              type="submit"
              :disabled="mutation.isPending.value"
            >
              {{ mutation.isPending.value ? "保存中..." : "保存个人信息" }}
            </button>
            <button
              data-testid="profile-logout"
              class="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white"
              type="button"
              @click="logout"
            >
              退出登录
            </button>
          </div>
        </div>
      </form>
    </section>
  </AppShell>
</template>
