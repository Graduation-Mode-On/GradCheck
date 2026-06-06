import Varlet from "@varlet/ui";
import "@varlet/ui/es/style";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";
import "./style.css";

createApp(App).use(Varlet).use(VueQueryPlugin).use(router).mount("#app");
