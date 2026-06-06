<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import AppShell from "../components/AppShell.vue";

type Section = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  blocks: SectionBlock[];
};

type SectionBlock = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

const sections: Section[] = [
  {
    id: "scope",
    eyebrow: "序章",
    title: "适用范围",
    blocks: [
      {
        bullets: [
          "本文按本科生离校流程整理；研究生请按「研究生组」流程单独办理。",
          "离校系统中未完成环节通常显示为红色，完成审核后会变为绿色；系统同步可能存在延迟。"
        ]
      }
    ]
  },
  {
    id: "enter-system",
    eyebrow: "第一幕",
    title: "先进入「学生离校」系统",
    blocks: [
      {
        bullets: [
          "登录网上办事大厅。",
          "进入「学生离校」。",
          "选择「本科生组」。",
          "逐项查看待办环节，按系统颜色跟踪进度。",
          "如某项已经线下办结但系统未变绿，先确认是否还在审核流转中，再联系对应老师或部门。"
        ]
      }
    ]
  },
  {
    id: "qualification",
    eyebrow: "第二幕",
    title: "先拿到离校资格",
    intro: "本科生通常要先满足两项前置条件：",
    blocks: [
      {
        bullets: [
          "毕设答辩通过。",
          "毕业设计相关材料打印并装入档案袋，提交学院档案室存档。"
        ]
      },
      {
        paragraphs: [
          "教务老师完成毕业审核后，会统一开通离校资格。",
          "在离校资格未开通前，后续很多环节无法继续推进，建议优先确认这一项。"
        ]
      }
    ]
  },
  {
    id: "administration",
    eyebrow: "第三幕",
    title: "学校行政部门手续",
    blocks: [
      {
        heading: "3.1 图书馆",
        bullets: [
          "根据系统提醒，查询是否存在借阅未还、逾期未缴费等情况。",
          "发现问题后及时还书或补缴费用。"
        ]
      },
      {
        heading: "3.2 档案馆",
        bullets: [
          "研究生论文审核通过后通常需要在档案馆上传终版论文。",
          "本科生通常无此环节，可直接按系统显示为准。"
        ]
      },
      {
        heading: "3.3 财务处",
        bullets: [
          "进入财务系统核对是否还有学费、住宿费或其他费用未缴清。",
          "如有欠费，先完成缴费，再等待系统同步。"
        ]
      },
      {
        heading: "3.4 保卫处：户口迁移",
        paragraphs: [
          "入学时将户口迁入学校的同学，需要按要求办理户口迁移。",
          "本科生一般会有一次集中办理机会，记得关注群通知并按时报名；错过后通常需要自行线上或线下办理。"
        ],
        bullets: [
          "线上自办：关注「南京公安」微信公众号，在「微服务」里办理户口迁移。",
          "升学：录取通知书、毕业证书、常住人口登记表、身份证。",
          "工作：三方协议、毕业证书、常住人口登记表、身份证。",
          "南京人才落户：无房证明、学信网学历认证电子表、常住人口登记表、身份证。",
          "回原籍：毕业证书、常住人口登记表、身份证。通常需在毕业证书生效后办理。",
          "户口迁入南京房屋：直接到房屋户口所在地派出所办理。",
          "线下办理地点：南京市江宁区行政服务中心（杨家圩 2 号），咨询电话 69977080。",
          "延迟毕业同学如需办理，建议直接联系保卫处户籍科确认口径。"
        ]
      },
      {
        heading: "3.5 组织关系",
        paragraphs: ["组织关系审核链条长、处理速度通常较慢，建议尽早办理。"],
        bullets: [
          "团组织关系转接：团员及未满 28 周岁的党员，在离校资格开通后需要登录智慧团建发起「关系转接」。",
          "党组织关系转接：已开通离校资格的党员（含预备党员），需先按党支部要求填写信息，再由党支部书记在校园信息门户的「东南大学组织管理信息系统」中录入去向并提交流程。",
          "转往东南大学校内其他单位：通常走校内网上接转，不开纸质介绍信。",
          "转往江苏省内：通常通过「全国党员信息管理系统」线上转接，不开纸质介绍信。",
          "转往江苏省外：需要申请纸质《组织关系介绍信》，到学院党委秘书处领取后按要求交至接收单位，并将回执寄回或送回学院。",
          "组织关系原则上只能在系统中提交一次；填写前务必先与接收单位确认介绍信抬头和去向。",
          "纸质介绍信通常有有效期（一般为 90 天），过期无效；丢失或未及时交接的后果需自行承担。"
        ]
      },
      {
        heading: "3.6 就业办：毕业去向与问卷调查",
        paragraphs: [
          "前往 91job 智慧就业平台完成毕业去向上报，并按要求完成问卷调查。"
        ],
        bullets: [
          "所有应届毕业生都需要核对毕业去向信息，尤其要仔细确认档案转递信息。",
          "线上签约的同学通常无需重复填报毕业去向，但仍需本人核对确认同步结果。",
          "线下纸质三方、国内升学、出国（境）留学等情况，通常需要主动填报并上传附件，等待学院和学校审核。",
          "就业：就业协议书乙方联照片，档案去向按协议要求填写。",
          "出国（境）留学：录取通知书，档案去向通常回原籍或按接收单位要求填写。",
          "国内升学：录取通知书，档案去向按录取学校要求填写。",
          "如果问卷已完成但系统仍未变绿，可联系就业办老师协助审核。"
        ]
      },
      {
        heading: "3.7 资助中心",
        bullets: [
          "办理助学贷款的同学，临近毕业通常需要配合中国银行到校集中办理毕业生贷款手续。",
          "若系统未通过或错过集中办理时间，及时联系校资助管理中心确认补办方式。"
        ]
      }
    ]
  },
  {
    id: "college",
    eyebrow: "第四幕",
    title: "学院收尾环节",
    blocks: [
      {
        heading: "4.1 院办",
        paragraphs: [
          "在图书馆、财务处、组织关系、就业去向等前置环节基本完成后，再联系辅导员或学院老师核对。"
        ],
        bullets: [
          "需确认已经提交归档材料，如《毕业登记表》《学位申请书》和成绩单等。",
          "本科生在这一环节通常还需要注销学生证：带学生证到辅导员处加盖注销章。",
          "如学生证遗失，需按要求提交登报挂失证明或学院认可的替代材料。"
        ]
      },
      {
        heading: "4.2 宿管科",
        bullets: [
          "在校住宿的同学需要到宿管处办理退宿，并结清水电费。",
          "务必请宿管阿姨在离校系统中完成通过，否则系统可能一直卡在未办结状态。",
          "退宿后通常需要在 3 天内搬离宿舍，计划继续留在南京的同学要提前安排住宿。"
        ]
      }
    ]
  },
  {
    id: "diploma",
    eyebrow: "第五幕",
    title: "领取双证与档案转递",
    blocks: [
      {
        heading: "5.1 领取毕业证和学位证",
        bullets: [
          "本科生在完成除「双证领取」外的其他必办离校手续后，可到教务老师处领取毕业证和学位证。",
          "一般需本人领取；如本人无法到场，可提前准备委托书，由受托人代领。"
        ]
      },
      {
        heading: "5.2 档案转递",
        paragraphs: ["档案去向通常以以下材料为准："],
        bullets: [
          "91job 就业管理系统中的毕业去向与档案信息。",
          "调档函。",
          "本人回原籍申请书（适用于原籍人才机构愿意接收但不出具调档函的情况）。",
          "办理完离校手续后，学院会将《毕业登记表》、学位授予决定、存档用成绩单、奖惩证明等材料归档，再移交档案馆办理出档。",
          "档案馆通常每周四出档，寒暑假和法定节假日除外。",
          "档案处理进度可通过档案馆电子系统查询。",
          "档案接收地址一定要提前确认清楚；地址不明确或接收单位信息错误，容易被退回，后续查询和补寄都很麻烦。"
        ]
      }
    ]
  },
  {
    id: "timing",
    eyebrow: "终章",
    title: "时间安排提醒",
    blocks: [
      {
        bullets: [
          "各环节「办完」到系统变绿之间通常有审核和同步时间，临近截止前不要卡点提交。",
          "组织关系审核通常最慢，建议优先完成。",
          "院办相关环节往往需要在其他环节基本全部办完后才能继续推进。",
          "本科生一般需要先完成学生事务、学生证注销等院办前置事项，之后才能办理双证领取。",
          "如果系统流程、材料要求或审核口径与本文不一致，以当年最新通知为准。"
        ]
      }
    ]
  }
];

const curtainOpen = ref(false);
const heroVisible = ref(false);
const revealed = ref<Record<string, boolean>>({});
const sectionRefs = ref<HTMLElement[]>([]);

let observer: IntersectionObserver | null = null;

function setSectionRef(element: Element | null, id: string) {
  if (!element) return;
  const el = element as HTMLElement;
  el.dataset.sectionId = id;
  if (!sectionRefs.value.includes(el)) {
    sectionRefs.value.push(el);
  }
}

onMounted(() => {
  // Curtain pulls back almost immediately to start the show, hero unfurls just after.
  window.requestAnimationFrame(() => {
    curtainOpen.value = true;
  });
  window.setTimeout(() => {
    heroVisible.value = true;
  }, 450);

  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (id) {
            revealed.value[id] = true;
            observer?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    for (const el of sectionRefs.value) {
      observer.observe(el);
    }
  } else {
    for (const section of sections) {
      revealed.value[section.id] = true;
    }
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <AppShell>
    <div class="graduation-stage">
      <div class="curtain" :class="{ 'curtain-open': curtainOpen }" aria-hidden="true">
        <div class="curtain-panel curtain-left" />
        <div class="curtain-panel curtain-right" />
      </div>

      <header class="hero" :class="{ 'hero-visible': heroVisible }">
        <p class="hero-eyebrow">大结局</p>
        <h1 class="hero-title">毕业指南</h1>
        <p class="hero-subtitle">谨以此页，送别四年。</p>
        <div class="hero-rule" />
        <p class="hero-lede">
          从离校系统的第一项打勾，到把学生证交到辅导员手里，再到把档案稳稳寄到下一站——
          这份指南陪你把所有幕都演完。
        </p>
      </header>

      <main class="acts">
        <section
          v-for="section in sections"
          :key="section.id"
          :ref="(el) => setSectionRef(el as Element | null, section.id)"
          :data-testid="`graduation-guide-section-${section.id}`"
          class="act"
          :class="{ 'act-visible': revealed[section.id] }"
        >
          <div class="act-eyebrow">{{ section.eyebrow }}</div>
          <h2 class="act-title">
            <span class="act-title-drop">{{ section.title.charAt(0) }}</span>
            <span class="act-title-rest">{{ section.title.slice(1) }}</span>
          </h2>
          <div class="act-rule" />
          <p v-if="section.intro" class="act-intro">{{ section.intro }}</p>

          <div v-for="(block, blockIndex) in section.blocks" :key="blockIndex" class="act-block">
            <h3 v-if="block.heading" class="act-block-heading">{{ block.heading }}</h3>
            <p v-for="(paragraph, pIndex) in block.paragraphs" :key="`p-${pIndex}`" class="act-paragraph">
              {{ paragraph }}
            </p>
            <ul v-if="block.bullets && block.bullets.length" class="act-list">
              <li v-for="(bullet, bIndex) in block.bullets" :key="`b-${bIndex}`">{{ bullet }}</li>
            </ul>
          </div>
        </section>
      </main>

      <footer class="finale" :class="{ 'finale-visible': revealed.timing }">
        <div class="finale-rule" />
        <p class="finale-line">— 落幕 —</p>
        <p class="finale-blessing">愿你出走半生，归来仍是少年。前程似锦，山海可期。</p>
      </footer>
    </div>
  </AppShell>
</template>

<style scoped>
.graduation-stage {
  position: relative;
  min-height: 100vh;
  padding: 0 1rem 6rem;
  background: radial-gradient(circle at 50% -10%, rgba(252, 220, 165, 0.5), transparent 55%),
    linear-gradient(180deg, #fdf6ec 0%, #f6ead7 45%, #efe1c4 100%);
  color: #3a2a17;
  overflow: hidden;
}

.curtain {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  display: flex;
}

.curtain-panel {
  flex: 1;
  background: linear-gradient(180deg, #4b0d12 0%, #2a070a 100%);
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.45);
  transition: transform 1.8s cubic-bezier(0.65, 0.05, 0.36, 1);
}

.curtain-left {
  transform: translateX(0);
}

.curtain-right {
  transform: translateX(0);
}

.curtain-open .curtain-left {
  transform: translateX(-105%);
}

.curtain-open .curtain-right {
  transform: translateX(105%);
}

.hero {
  position: relative;
  z-index: 1;
  max-width: 38rem;
  margin: 0 auto;
  padding: 6rem 0 4rem;
  text-align: center;
  opacity: 0;
  transform: translateY(24px) scale(0.98);
  transition: opacity 1.6s ease-out, transform 1.6s ease-out;
}

.hero-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.hero-eyebrow {
  font-size: 0.85rem;
  letter-spacing: 0.6em;
  color: #a35a1a;
  text-transform: uppercase;
}

.hero-title {
  margin-top: 0.75rem;
  font-size: clamp(2.8rem, 8vw, 4.2rem);
  font-weight: 800;
  letter-spacing: 0.35em;
  color: #2c1606;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.hero-subtitle {
  margin-top: 0.5rem;
  font-size: 1rem;
  letter-spacing: 0.45em;
  color: #6f4a1d;
}

.hero-rule {
  margin: 2rem auto 1.5rem;
  height: 1px;
  width: 0;
  background: linear-gradient(90deg, transparent, #c08a3e, transparent);
  transition: width 2.4s ease-out 0.4s;
}

.hero-visible .hero-rule {
  width: 70%;
}

.hero-lede {
  font-size: 1rem;
  line-height: 2;
  color: #5a3d18;
}

.acts {
  position: relative;
  z-index: 1;
  max-width: 38rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.act {
  position: relative;
  padding: 2rem 1.5rem 2.25rem;
  border-radius: 1.25rem;
  background: rgba(255, 250, 240, 0.7);
  backdrop-filter: blur(6px);
  box-shadow: 0 12px 36px -22px rgba(83, 49, 13, 0.35);
  opacity: 0;
  transform: translateY(36px);
  transition: opacity 1.1s ease-out, transform 1.1s ease-out;
}

.act-visible {
  opacity: 1;
  transform: translateY(0);
}

.act-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.5em;
  color: #a35a1a;
  text-transform: uppercase;
}

.act-title {
  margin-top: 0.4rem;
  font-size: 1.6rem;
  font-weight: 700;
  color: #2c1606;
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.act-title-drop {
  font-size: 2.6rem;
  line-height: 1;
  color: #b9742a;
  font-weight: 800;
}

.act-rule {
  margin: 0.75rem 0 1rem;
  height: 1px;
  width: 0;
  background: linear-gradient(90deg, #c08a3e, transparent);
  transition: width 1.4s ease-out 0.2s;
}

.act-visible .act-rule {
  width: 55%;
}

.act-intro {
  font-size: 0.98rem;
  line-height: 1.9;
  color: #5a3d18;
}

.act-block {
  margin-top: 1.25rem;
}

.act-block-heading {
  font-size: 1.05rem;
  font-weight: 600;
  color: #7a3d10;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.act-paragraph {
  font-size: 0.95rem;
  line-height: 1.95;
  color: #4a2f10;
  margin-bottom: 0.5rem;
}

.act-list {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.act-list li {
  position: relative;
  padding-left: 1.1rem;
  font-size: 0.95rem;
  line-height: 1.85;
  color: #4a2f10;
}

.act-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.85rem;
  width: 0.45rem;
  height: 1px;
  background: #b9742a;
}

.finale {
  position: relative;
  z-index: 1;
  max-width: 38rem;
  margin: 5rem auto 0;
  text-align: center;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 1.6s ease-out 0.4s, transform 1.6s ease-out 0.4s;
}

.finale-visible {
  opacity: 1;
  transform: translateY(0);
}

.finale-rule {
  margin: 0 auto 1.5rem;
  height: 1px;
  width: 60%;
  background: linear-gradient(90deg, transparent, #c08a3e, transparent);
}

.finale-line {
  font-size: 1.1rem;
  letter-spacing: 0.6em;
  color: #7a3d10;
}

.finale-blessing {
  margin-top: 0.75rem;
  font-size: 0.95rem;
  letter-spacing: 0.15em;
  line-height: 2;
  color: #5a3d18;
}

@media (min-width: 640px) {
  .graduation-stage {
    padding-left: 2rem;
    padding-right: 2rem;
  }
  .act {
    padding: 2.5rem 2.25rem 2.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .curtain-panel,
  .hero,
  .hero-rule,
  .act,
  .act-rule,
  .finale {
    transition: none !important;
  }
  .curtain-left,
  .curtain-right {
    transform: translateX(-105%);
  }
  .hero,
  .act,
  .finale {
    opacity: 1;
    transform: none;
  }
  .hero-rule,
  .act-rule {
    width: 60%;
  }
}
</style>
