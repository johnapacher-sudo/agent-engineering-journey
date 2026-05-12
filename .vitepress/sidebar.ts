import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
}

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
}

function prettifyTitle(filename: string): string {
  const base = filename.replace(/\.md$/, '')
  const withoutPrefix = base.replace(/^\d+[-_]?/, '')
  return withoutPrefix.replace(/[-_]/g, ' ')
}

function prettifyDayTitle(dirname: string): string {
  const m = dirname.match(/^day-(\d+)$/)
  return m ? `Day ${Number(m[1])}` : dirname
}

function buildSubfolder(
  dayDir: string,
  dayName: string,
  subfolder: string,
  label: string,
) {
  const subPath = join(ROOT, 'daily-docs', dayName, subfolder)
  const files = listMarkdown(subPath)
  if (files.length === 0) return null

  const items: any[] = []

  if (existsSync(join(subPath, 'README.md'))) {
    items.push({
      text: '索引',
      link: `/daily-docs/${dayName}/${subfolder}/`,
    })
  }

  for (const f of files) {
    items.push({
      text: prettifyTitle(f),
      link: `/daily-docs/${dayName}/${subfolder}/${f.replace(/\.md$/, '')}`,
    })
  }

  return {
    text: label,
    collapsed: true,
    items,
  }
}

export function genDailyDocsSidebar() {
  const dailyDocsDir = join(ROOT, 'daily-docs')
  const dayDirs = listDirs(dailyDocsDir)

  return dayDirs.map((dayName) => {
    const items: any[] = []

    const readmePath = join(dailyDocsDir, dayName, 'README.md')
    if (existsSync(readmePath)) {
      items.push({
        text: '概览',
        link: `/daily-docs/${dayName}/`,
      })
    }

    const learning = buildSubfolder(
      dailyDocsDir,
      dayName,
      'learning-resources',
      '学习笔记',
    )
    if (learning) items.push(learning)

    const extra = buildSubfolder(
      dailyDocsDir,
      dayName,
      'extracurricular_materials',
      '课外材料',
    )
    if (extra) items.push(extra)

    return {
      text: prettifyDayTitle(dayName),
      collapsed: true,
      items,
    }
  })
}

export function genDailyIndexSidebar() {
  const dailyDir = join(ROOT, 'daily')
  const files = listMarkdown(dailyDir)

  return [
    {
      text: '每日计划',
      items: files.map((f) => {
        const base = f.replace(/\.md$/, '')
        const m = base.match(/^day-(\d+)$/)
        return {
          text: m ? `Day ${Number(m[1])}` : base,
          link: `/daily/${base}`,
        }
      }),
    },
  ]
}
