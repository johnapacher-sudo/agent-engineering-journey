import { defineConfig } from 'vitepress'
import { genDailyDocsSidebar, genDailyIndexSidebar } from './sidebar'

export default defineConfig({
  title: 'Agent Engineer Journey',
  description: '6-month learning journal — Agent engineering from zero',
  lang: 'zh-CN',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  srcExclude: [
    '**/node_modules/**',
    '**/demo/**',
    '**/Next_Drizzle_Neon_demo/**',
    'scripts/**',
  ],

  rewrites: {
    'daily-docs/:day/README.md': 'daily-docs/:day/index.md',
    'daily-docs/:day/:subfolder/README.md': 'daily-docs/:day/:subfolder/index.md',
  },

  themeConfig: {
    outline: { level: [2, 3], label: '本页导航' },
    search: { provider: 'local' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '最后更新',
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',

    nav: [
      { text: '首页', link: '/' },
      { text: '学习方法', link: '/LEARNING_METHOD' },
      { text: '6 个月路线', link: '/ROADMAP_6M' },
      { text: '每日计划', link: '/daily/' },
      { text: '每日材料', link: '/daily-docs/' },
    ],

    sidebar: {
      '/daily/': genDailyIndexSidebar(),
      '/daily-docs/': genDailyDocsSidebar(),
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jianweicui/agent-engineering-journey' },
    ],
  },
})
