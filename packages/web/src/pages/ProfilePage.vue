<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import { seuColleges } from "../constants/colleges";
import { enrollmentGrades } from "../constants/grades";
import { clearToken, getCurrentUser, getToken, updateProfile } from "../lib/api";
import { profileSchema } from "../schemas/auth";

const router = useRouter();
const queryClient = useQueryClient();
const message = ref("");
const form = reactive({
  displayName: "",
  studentId: "",
  pushplusToken: "",
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
  form.studentId = profile.studentId ?? "";
  form.pushplusToken = profile.pushplusToken ?? "";
});

const mutation = useMutation({
  mutationFn: async () => updateProfile(profileSchema.parse(form)),
  onSuccess: async () => {
    message.value = "个人信息已保存";
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    await queryClient.invalidateQueries({ queryKey: ["candidate-courses"] });
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
      <h1 class="text-2xl font-bold text-[var(--tommy-text)]">个人信息</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">这些字段会作为后续毕业判断、推荐和学院特色要求的基础上下文。</p>

      <form class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="mutation.mutate()">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          显示名称
          <input v-model="form.displayName" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          学生一卡通
          <input
            data-testid="profile-student-id"
            v-model="form.studentId"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            inputmode="numeric"
            pattern="\d{9}"
            maxlength="9"
            placeholder="例如 213220001"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          PushPlus 推送 token（可选）
          <input
            data-testid="profile-pushplus-token"
            v-model="form.pushplusToken"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
            maxlength="32"
            placeholder="32 位十六进制，留空表示不接收微信推送"
          />
          <span class="mt-1 block text-xs text-[var(--tommy-text-secondary)]">
            关注公众号「pushplus 推送加」→ 个人中心 → 复制你的 token 填到这里。绑定后实验/考试到期前会推送提醒。
          </span>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          学院
          <select data-testid="profile-college" v-model="form.college" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="" disabled>请选择学院</option>
            <option v-for="college in seuColleges" :key="college" :value="college">{{ college }}</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          专业
          <input v-model="form.major" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          年级
          <select data-testid="profile-grade" v-model.number="form.grade" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option v-for="grade in enrollmentGrades" :key="grade" :value="grade">{{ grade }}</option>
          </select>
        </label>
        <div class="sm:col-span-2">
          <p v-if="message" class="mb-3 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>
          <div class="flex flex-wrap gap-3">
            <button
              class="rounded-xl bg-[var(--tommy-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-60"
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

    <RouterLink
      to="/graduation-guide"
      data-testid="profile-graduation-guide"
      class="mt-4 block rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">大结局</p>
      <h2 class="mt-1 text-xl font-bold text-[var(--tommy-text)]">毕业指南</h2>
      <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
        从离校系统到双证领取，一份缓缓展开的离校剧本，陪你走完最后一程。
      </p>
    </RouterLink>
  </AppShell>
</template>
