# Day 19 · 2026-05-26（周二）

> Week 3 · 队列与事件驱动（Inngest）
> 今天 2.5-3h

## 今天学什么

**主题**：一个端到端的真实异步 pipeline —— 综合 Week 3 所有武器。

前几天都是 demo function。今天做一个**有业务价值**的完整 pipeline：用户上传图片 → 生成缩略图 → OCR 提取文字 → 通知用户。这个形状是 M3 RAG ingestion / M5 agent 长任务的原型。今天做完你就理解了"agent 长任务架构"的一半。

## 核心概念

- **Pipeline 的 step 粒度**：4 步骤各一个 `step.run`，任何一步失败只重跑它自己。
- **外部 IO 全部包在 step 里**：上传 Blob、发 HTTP、写 DB 都用 step 隔离，这样失败点明确、重试粒度对。
- **状态表驱动 UI**：`uploads` 表有 `status: pending / processing / done / failed`，前端根据这个渲染进度。不要在 UI 里猜状态。
- **通知的两条腿**：in-app（写 `notifications` 表，UI 显示小红点）+ email（异步发）。生产系统一般两边都要。
- **Vercel Blob 的 client upload**：大文件（>4.5MB）不能走 Server Action（Vercel 4.5MB body 限制）。要让 client 直接 upload 到 Blob，然后只把 URL 发给 server。这是 Agent 应用里处理"用户上传文档"的标准姿势。
- **OCR 的算力问题**：Tesseract.js 跑在 serverless function 里会超时 / 吃光内存。正确做法是**用云端 OCR API**（Google Vision / AWS Textract），或 agent 场景下用 LLM 多模态（Claude / GPT-5 Vision）。今天先用 mock 占位，感受 pipeline 形状。

## 参考资源

- **[Vercel Blob: Client Uploads](https://vercel.com/docs/storage/vercel-blob/client-upload)** — 15 min
- **[Inngest + Next.js Production Example](https://www.inngest.com/docs/examples)** — 扫一眼 examples 里的 "file processing" 类
- **[sharp docs](https://sharp.pixelplumbing.com/)** — 生成缩略图用

## 动手练习

### Part 1 · Schema 和页面骨架（30 min）

1. schema 加两张表：
   ```ts
   export const uploads = pgTable('uploads', {
     id: uuid('id').primaryKey().defaultRandom(),
     userId: uuid('user_id').notNull().references(() => users.id),
     originalUrl: text('original_url').notNull(),
     thumbnailUrl: text('thumbnail_url'),
     extractedText: text('extracted_text'),
     status: text('status', { enum: ['pending', 'processing', 'done', 'failed'] }).notNull().default('pending'),
     errorMessage: text('error_message'),
     createdAt: timestamp('created_at').notNull().defaultNow(),
   })

   export const notifications = pgTable('notifications', {
     id: uuid('id').primaryKey().defaultRandom(),
     userId: uuid('user_id').notNull().references(() => users.id),
     kind: text('kind').notNull(),
     title: text('title').notNull(),
     body: text('body'),
     readAt: timestamp('read_at'),
     createdAt: timestamp('created_at').notNull().defaultNow(),
   })
   ```
2. migrate
3. `/upload` 页：一个 `<input type="file">`，上传成功后调 Server Action 创 `uploads` 行 → 发 Inngest event

### Part 2 · Vercel Blob client upload（30 min）

1. `pnpm add @vercel/blob`
2. 配置 `BLOB_READ_WRITE_TOKEN`（Vercel dashboard 生成）
3. 写 `/api/upload/url` route（生成 client upload token）:
   ```ts
   import { handleUpload } from '@vercel/blob/client'
   export async function POST(request: Request) {
     const body = await request.json()
     const jsonResponse = await handleUpload({
       body,
       request,
       onBeforeGenerateToken: async () => {
         const user = await requireUser()
         return {
           allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
           maximumSizeInBytes: 5 * 1024 * 1024,
           tokenPayload: JSON.stringify({ userId: user.id }),
         }
       },
       onUploadCompleted: async ({ blob, tokenPayload }) => {
         const { userId } = JSON.parse(tokenPayload!)
         const [upload] = await db.insert(uploads).values({
           userId,
           originalUrl: blob.url,
           status: 'pending',
         }).returning()
         await inngest.send({
           name: 'image/uploaded',
           data: { uploadId: upload.id, originalUrl: blob.url, userId },
         })
       },
     })
     return Response.json(jsonResponse)
   }
   ```
4. `/upload` 页 client component 用 `@vercel/blob/client` 的 `upload()` 函数

### Part 3 · Pipeline function（60 min）

`src/inngest/functions/process-image.ts`：

```ts
export const processImageFn = inngest.createFunction(
  {
    id: 'process-image',
    concurrency: { limit: 3, key: 'event.data.userId' },  // 每用户最多并行 3 个
    retries: 3,
    onFailure: async ({ event, error }) => {
      await db.update(uploads)
        .set({ status: 'failed', errorMessage: error.message })
        .where(eq(uploads.id, event.data.uploadId))
    },
  },
  { event: 'image/uploaded' },
  async ({ event, step }) => {
    const { uploadId, originalUrl, userId } = event.data

    // Step 1: 标记 processing
    await step.run('mark-processing', () =>
      db.update(uploads).set({ status: 'processing' }).where(eq(uploads.id, uploadId))
    )

    // Step 2: 生成缩略图
    const thumbnailUrl = await step.run('generate-thumbnail', async () => {
      const res = await fetch(originalUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      const thumb = await sharp(buffer).resize(400, 400, { fit: 'inside' }).webp().toBuffer()
      const blob = await put(`thumb-${uploadId}.webp`, thumb, { access: 'public' })
      return blob.url
    })

    // Step 3: OCR（今天 mock）
    const extractedText = await step.run('ocr', async () => {
      // TODO: 真实场景用 Claude Vision / Google Vision
      await new Promise(r => setTimeout(r, 2000))
      return `[mock OCR] extracted text from ${uploadId}`
    })

    // Step 4: 更新 DB
    await step.run('update-db', () =>
      db.update(uploads)
        .set({ thumbnailUrl, extractedText, status: 'done' })
        .where(eq(uploads.id, uploadId))
    )

    // Step 5: 通知用户（in-app + email）
    await step.run('notify-in-app', () =>
      db.insert(notifications).values({
        userId,
        kind: 'upload.done',
        title: '图片处理完成',
        body: `${extractedText.slice(0, 60)}...`,
      })
    )

    await step.run('notify-email', async () => {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      await resend.emails.send({
        from: 'notify@yourdomain.com',
        to: user.email,
        subject: '图片处理完成',
        html: `<p>你的图片已处理完，<a href="https://yourapp.com/uploads/${uploadId}">查看</a></p>`,
      })
    })
  }
)
```

### Part 4 · UI 实时状态（30 min）

`/uploads` 页面：列出当前用户的 uploads，每条显示 status + thumbnail。

用 Next.js 的 `revalidatePath` 或者客户端轮询实现"处理完自动刷新"。进阶可以上 Server-Sent Events（Week 4 会深入，今天先不做）。

### Part 5 · 部署和生产验证（30 min）

1. 部署到 Vercel
2. 生产配 Inngest webhook（Inngest dashboard 里 connect 你的 app）
3. 真上传一张图
4. 看生产 Inngest dashboard 里的 run
5. 故意断网 / 改环境变量触发失败 → 看 retry 和 `onFailure`

**卡点思考**：
- 如果 step 3 OCR 失败，step 1-2 已经成功。重试时 step 1-2 会重跑吗？会不会重新生成一个新缩略图？
- 用户在 Step 2 和 Step 3 之间删了 upload 记录（级联？），Step 3 的 `db.update` 会怎样？怎么防？
- 如果 Vercel 部署上线时有 10 个 pipeline 在运行，重启后会中断吗？

## 今天结束能回答

- 一个 pipeline 中间步骤失败后重试，已完成 step 的结果是从哪里读回的？这东西能跨 Vercel 部署吗？
- 把 OCR 这一步从 mock 换成真实的 Claude Vision，需要改哪些地方？成本和 latency 会变成什么样？（为 M2 Week 5 的 LLM 做铺垫）
- 为什么大文件上传不能走 Server Action？client upload token 的安全边界在哪？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 20）是 Week 3 阶段 2 精读日 —— Inngest 全景 + 对比其他队列方案
