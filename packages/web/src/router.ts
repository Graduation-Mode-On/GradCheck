import { createRouter, createWebHistory } from "vue-router";

import CoursesPage from "./pages/CoursesPage.vue";
import CustomRequirementsPage from "./pages/CustomRequirementsPage.vue";
import GpaCourseMatchesPage from "./pages/GpaCourseMatchesPage.vue";
import GpaPage from "./pages/GpaPage.vue";
import HomePage from "./pages/HomePage.vue";
import LecturePracticePage from "./pages/LecturePracticePage.vue";
import LoginPage from "./pages/LoginPage.vue";
import NewsPage from "./pages/NewsPage.vue";
import CourseRecommendationsPage from "./pages/CourseRecommendationsPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import PlazaPage from "./pages/PlazaPage.vue";
import PlansPage from "./pages/PlansPage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import SportsPage from "./pages/SportsPage.vue";
import SrtpPage from "./pages/SrtpPage.vue";
import VolunteerPage from "./pages/VolunteerPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    {
      path: "/plans",
      name: "plans",
      component: PlansPage
    },
    {
      path: "/courses",
      name: "courses",
      component: CoursesPage
    },
    {
      path: "/gpa",
      name: "gpa",
      component: GpaPage
    },
    {
      path: "/gpa/course-matches",
      name: "gpa-course-matches",
      component: GpaCourseMatchesPage
    },
    {
      path: "/course-recommendations",
      name: "course-recommendations",
      component: CourseRecommendationsPage
    },
    {
      path: "/sports",
      name: "sports",
      component: SportsPage,
      meta: { title: "体育跑操", description: "后续用于记录体测、跑操次数和体育毕业风险。" }
    },
    { path: "/lecture-practice", name: "lecture-practice", component: LecturePracticePage },
    { path: "/news", name: "news", component: NewsPage },
    { path: "/plaza", name: "plaza", component: PlazaPage },
    { path: "/volunteer", name: "volunteer", component: VolunteerPage },
    {
      path: "/exams",
      name: "exams",
      component: PlaceholderPage,
      meta: { title: "实验考试", description: "后续集中管理实验课时间段、考试信息和提前提醒。" }
    },
    {
      path: "/custom-requirements",
      name: "custom-requirements",
      component: CustomRequirementsPage,
      meta: { title: "自定义要求", description: "后续支持学院特色要求和用户自定义毕业要求。" }
    },
    {
      path: "/srtp",
      name: "srtp",
      component: SrtpPage
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
