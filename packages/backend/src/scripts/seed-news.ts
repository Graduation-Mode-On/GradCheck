import { createDb } from "../db/client.js";
import { loadConfig } from "../lib/config.js";
import { createNewsRepository } from "../modules/news/news.repository.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const newsRepository = createNewsRepository(db);

const now = new Date();
const future = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const past = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const mockNews = [
  // 讲座
  {
    title: "人工智能前沿：大模型技术解析与产业应用",
    type: "lecture" as const,
    organizer: "计算机科学与工程学院",
    location: "九龙湖校区纪忠楼报告厅",
    startTime: future(3),
    endTime: future(3),
    registrationUrl: "https://jwc.seu.edu.cn/lecture/ai-2026",
    targetAudience: "全校",
    creditCategory: "学术前沿讲座",
    description: "邀请业界专家深入讲解大语言模型技术原理、训练方法及在产业中的落地应用。面向全校师生开放，计入学术前沿讲座次数。",
    sourceUrl: "https://jwc.seu.edu.cn",
    sourceName: "教务处",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "东大人文大讲堂：中国古典文学与当代生活",
    type: "lecture" as const,
    organizer: "人文学院",
    location: "四牌楼校区大礼堂",
    startTime: future(7),
    endTime: future(7),
    registrationUrl: null,
    targetAudience: "全校",
    creditCategory: "人文讲座",
    description: "探讨中国古典文学中的智慧如何在当代生活中得到新的诠释与应用。",
    sourceUrl: "https://rw.seu.edu.cn",
    sourceName: "人文学院",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "计软智学院 IT 技术沙龙：云原生架构实践",
    type: "lecture" as const,
    organizer: "计算机科学与工程学院",
    location: "计算机楼 320 会议室",
    startTime: future(5),
    endTime: future(5),
    registrationUrl: "https://cs.seu.edu.cn/it-salon",
    targetAudience: "计软智学院",
    creditCategory: "IT讲座",
    description: "面向计算机学院学生的技术分享，介绍 Kubernetes、微服务等云原生技术的实践经验。",
    sourceUrl: "https://cs.seu.edu.cn",
    sourceName: "计软智学院",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "创新创业系列讲座：从校园到独角兽",
    type: "lecture" as const,
    organizer: "创新创业学院",
    location: "九龙湖校区教一 101",
    startTime: future(10),
    endTime: future(10),
    registrationUrl: null,
    targetAudience: "全校",
    creditCategory: "创新创业讲座",
    description: "邀请校友创业者分享从校园项目到独角兽企业的成长历程。",
    sourceUrl: "https://cxcy.seu.edu.cn",
    sourceName: "创新创业学院",
    dataQuality: "partial" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "信息学院导师会客厅：科研入门指南",
    type: "lecture" as const,
    organizer: "信息科学与工程学院",
    location: "信息学院大楼 A201",
    startTime: future(14),
    endTime: future(14),
    registrationUrl: "https://ise.seu.edu.cn/salon",
    targetAudience: "信息学院",
    creditCategory: "导师会客厅",
    description: "信息学院特色活动，邀请知名导师与学生面对面交流科研方向选择与入门方法。",
    sourceUrl: "https://ise.seu.edu.cn",
    sourceName: "信息学院",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  // 竞赛
  {
    title: "2026年全国大学生数学建模竞赛校内选拔赛",
    type: "competition" as const,
    organizer: "数学学院",
    location: "线上报名",
    startTime: future(20),
    endTime: future(25),
    registrationUrl: "https://math.seu.edu.cn/mcm",
    targetAudience: "全校",
    creditCategory: "学科竞赛",
    description: "全国大学生数学建模竞赛（CUMCM）校内选拔赛，获奖可计入学科竞赛成绩，优异者代表学校参加全国赛。",
    sourceUrl: "https://math.seu.edu.cn",
    sourceName: "数学学院",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "ACM-ICPC 程序设计竞赛秋季训练营",
    type: "competition" as const,
    organizer: "计算机科学与工程学院",
    location: "计算机楼机房",
    startTime: future(2),
    endTime: future(30),
    registrationUrl: "https://acm.seu.edu.cn/training",
    targetAudience: "全校",
    creditCategory: "学科竞赛",
    description: "ACM 竞赛集训营，每周两次训练赛。通过选拔的同学将代表学校参加区域赛。",
    sourceUrl: "https://acm.seu.edu.cn",
    sourceName: "ACM实验室",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "东南大学创新创业大赛",
    type: "competition" as const,
    organizer: "创新创业学院",
    location: "九龙湖校区大学生活动中心",
    startTime: future(45),
    endTime: future(50),
    registrationUrl: "https://cxcy.seu.edu.cn/contest",
    targetAudience: "全校",
    creditCategory: "创新创业竞赛",
    description: "面向全校学生的创新创业项目比赛，分创意组和创业组，获奖可获课外研学学分认定。",
    sourceUrl: "https://cxcy.seu.edu.cn",
    sourceName: "创新创业学院",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "全国大学生电子设计竞赛校内选拔",
    type: "competition" as const,
    organizer: "电子科学与工程学院",
    location: "电子楼实验室",
    startTime: future(15),
    endTime: future(20),
    registrationUrl: null,
    targetAudience: "电子/信息/自动化学院",
    creditCategory: "学科竞赛",
    description: "全国大学生电子设计竞赛校内选拔赛，四天三夜的硬件设计与调试挑战。",
    sourceUrl: "https://ese.seu.edu.cn",
    sourceName: "电子学院",
    dataQuality: "partial" as const,
    status: "active" as const,
    scrapedAt: now
  },
  // 项目
  {
    title: "2026年度 SRTP 学生科研训练计划申报",
    type: "project" as const,
    organizer: "教务处",
    location: "线上系统",
    startTime: past(5),
    endTime: future(60),
    registrationUrl: "https://srtp.seu.edu.cn",
    targetAudience: "全校本科生",
    creditCategory: "SRTP",
    description: "本科生科研训练计划（SRTP），学生可在导师指导下申报科研项目，完成后可获得课外研学学分。",
    sourceUrl: "https://jwc.seu.edu.cn",
    sourceName: "教务处",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "暑期社会实践：乡村振兴调研项目",
    type: "project" as const,
    organizer: "校团委社会实践部",
    location: "江苏省各地市",
    startTime: future(40),
    endTime: future(55),
    registrationUrl: "https://tw.seu.edu.cn/social",
    targetAudience: "全校",
    creditCategory: "社会实践",
    description: "组织团队赴江苏省各地乡村开展调研，撰写调研报告并完成社会实践学分认定。",
    sourceUrl: "https://tw.seu.edu.cn",
    sourceName: "校团委",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "计算机学院科研助理招募：智能计算实验室",
    type: "project" as const,
    organizer: "智能计算实验室",
    location: "计算机楼 505",
    startTime: future(1),
    endTime: future(90),
    registrationUrl: "https://iclab.seu.edu.cn/recruit",
    targetAudience: "计软智学院大二及以上",
    creditCategory: "科研训练",
    description: "招募本科生科研助理参与深度学习、计算机视觉方向课题研究，提供科研训练和论文发表机会。",
    sourceUrl: "https://iclab.seu.edu.cn",
    sourceName: "智能计算实验室",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "挑战杯课外学术科技作品竞赛备赛",
    type: "project" as const,
    organizer: "校团委",
    location: "九龙湖校区",
    startTime: future(30),
    endTime: future(120),
    registrationUrl: "https://tw.seu.edu.cn/challenge",
    targetAudience: "全校",
    creditCategory: "课外研学",
    description: "挑战杯备赛项目招募，已有项目团队需要补充成员，涵盖科技创新、哲学社会科学等方向。",
    sourceUrl: "https://tw.seu.edu.cn",
    sourceName: "校团委",
    dataQuality: "partial" as const,
    status: "active" as const,
    scrapedAt: now
  },
  // 实践
  {
    title: "「浦江学堂」志愿讲解服务招募",
    type: "practice" as const,
    organizer: "校青年志愿者协会",
    location: "南京市博物馆",
    startTime: future(7),
    endTime: future(90),
    registrationUrl: "https://volunteer.seu.edu.cn",
    targetAudience: "全校",
    creditCategory: "志愿服务",
    description: "招募志愿者参与南京市博物馆讲解服务，每周至少服务一次，每次计 2 小时志愿时长。",
    sourceUrl: "https://volunteer.seu.edu.cn",
    sourceName: "校青协",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "劳育实践：校园绿化养护志愿活动",
    type: "practice" as const,
    organizer: "后勤管理处",
    location: "九龙湖校区校园绿地",
    startTime: future(10),
    endTime: future(20),
    registrationUrl: null,
    targetAudience: "全校",
    creditCategory: "劳育实践",
    description: "参与校园绿化养护，包括植树、除草、浇水等，完成可认定劳育实践课时。",
    sourceUrl: "https://hq.seu.edu.cn",
    sourceName: "后勤管理处",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  },
  {
    title: "图书馆志愿服务：新书编目与整理",
    type: "practice" as const,
    organizer: "图书馆",
    location: "李文正图书馆",
    startTime: future(5),
    endTime: future(60),
    registrationUrl: "https://lib.seu.edu.cn/volunteer",
    targetAudience: "全校",
    creditCategory: "志愿服务",
    description: "协助图书馆进行新书编目、上架整理工作，可累计志愿时长并开具志愿服务证明。",
    sourceUrl: "https://lib.seu.edu.cn",
    sourceName: "图书馆",
    dataQuality: "complete" as const,
    status: "active" as const,
    scrapedAt: now
  }
];

async function seed() {
  console.log(`Seeding ${mockNews.length} news items...`);
  for (const item of mockNews) {
    await newsRepository.createItem(item);
  }
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
