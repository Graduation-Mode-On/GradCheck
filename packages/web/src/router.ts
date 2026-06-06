import { createRouter, createWebHistory } from "vue-router";

import HomePage from "./pages/HomePage.vue";
import LoginPage from "./pages/LoginPage.vue";
import NewsPage from "./pages/NewsPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import PlazaPage from "./pages/PlazaPage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import SportsPage from "./pages/SportsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    {
      path: "/plans",
      name: "plans",
      component: PlaceholderPage,
      meta: { title: "培养方案", description: "后续接入培养方案 PDF 解析、结构化确认和同专业方案复用。" }
    },
    {
      path: "/courses",
      name: "courses",
      component: PlaceholderPage,
      meta: { title: "课程进度", description: "后续用于记录课程状态、成绩、学分和毕业要求达标情况。" }
    },
    {
      path: "/gpa",
      name: "gpa",
      component: PlaceholderPage,
      meta: { title: "GPA目标", description: "后续支持东南大学 4.8 绩点规则、目标绩点和剩余课程估算。" }
    },
    {
      path: "/course-recommendations",
      name: "course-recommendations",
      component: PlaceholderPage,
      meta: { title: "选课推荐", description: "后续根据培养方案缺口、课程时间和个人偏好生成选课建议。" }
    },
    {
      path: "/sports",
      name: "sports",
      component: SportsPage,
      meta: { title: "体育跑操", description: "后续用于记录体测、跑操次数和体育毕业风险。" }
    },
    { path: "/news", name: "news", component: NewsPage },
    { path: "/plaza", name: "plaza", component: PlazaPage },
    {
      path: "/volunteer",
      name: "volunteer",
      component: PlaceholderPage,
      meta: { title: "志愿劳育", description: "后续管理志愿时长、心得提交、劳育理论课和实践课完成情况。" }
    },
    {
      path: "/exams",
      name: "exams",
      component: PlaceholderPage,
      meta: { title: "实验考试", description: "后续集中管理实验课时间段、考试信息和提前提醒。" }
    },
    {
      path: "/custom-requirements",
      name: "custom-requirements",
      component: PlaceholderPage,
      meta: { title: "自定义要求", description: "后续支持学院特色要求和用户自定义毕业要求。" }
    },
    {
      path: "/graduation-gift",
      name: "graduation-gift",
      component: PlaceholderPage,
      meta: { title: "毕业礼包", description: "当全部毕业要求满足且数据已确认后展示毕业指南入口。" }
    },
    { path: "/login", name: "login", component: LoginPage },
    { path: "/profile", name: "profile", component: ProfilePage }
  ]
});
