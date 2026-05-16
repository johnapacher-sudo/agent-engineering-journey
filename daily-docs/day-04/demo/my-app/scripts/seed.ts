import 'dotenv/config';
import {
    InsertPost,
    InsertPostsTags,
    InsertTag,
    InsertUser,
    PostStatus,
    postsTable,
    postsTagsTable,
    SelectPost,
    SelectTag,
    SelectUser,
    tagsTable,
    usersTable,
} from "@/db/schema";
import { db } from "@/db";
import { faker } from '@faker-js/faker';
import { createPost, createPostsTags, createTag, createUser } from '@/db/queries/insert';

const POST_STATUSES: PostStatus[] = ['draft', 'published', 'archived'];

const USER_COUNT = 50;
const POST_COUNT = 100;
// 必须存在的固定标签（用于测试筛选）
const FIXED_TAG_NAMES = ['react', 'vue'] as const;
// 除了固定标签外，再生成多少个随机 tag
const RANDOM_TAG_COUNT = 30;
const POST_TAGS_MIN = 1;
const POST_TAGS_MAX = 5;

/**
 * 生成 N 个不重复的随机 tag name。
 * 用 Set 兜底——faker.lorem.word() 字典有限，多次调用大概率会撞名。
 * 同时排除掉 excludes 里的 name（防止跟固定标签重复）。
 */
function generateUniqueRandomNames(
    targetCount: number,
    excludes: readonly string[] = [],
): string[] {
    const excludeSet = new Set(excludes.map(n => n.toLowerCase()));
    const collected = new Set<string>();
    let safety = 0;
    while (collected.size < targetCount && safety < targetCount * 20) {
        const name = faker.lorem.word().toLowerCase();
        if (!excludeSet.has(name)) collected.add(name);
        safety++;
    }
    return [...collected];
}

export function createRandomUser(): InsertUser {
    return {
        userName: faker.person.fullName(),
        email: `email-${faker.string.uuid()}@example.com`,
        password: faker.internet.password(),
    };
}

export function createRandomPost(userId: SelectUser['id']): InsertPost {
    const status = POST_STATUSES[createRandomInteger(0, POST_STATUSES.length - 1)];
    return {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        status,
        publishedAt: status === 'published' ? faker.date.recent({ days: 30 }) : null,
        userId,
    };
}

export function createRandomTag(name?: string): InsertTag {
    return {
        name: name ?? faker.lorem.word(),
    };
}

export function createRandomPostsTags(postId: SelectPost['id'], tagId: SelectTag['id']): InsertPostsTags {
    return { postId, tagId };
}

export function createRandomInteger(min: number, max: number): number {
    return faker.number.int({ min, max });
}

const cleanDatabase = async () => {
    console.log('Cleaning up database...');
    console.log('Deleting posts tags...');
    await db.delete(postsTagsTable);
    console.log('Posts tags deleted');
    console.log('Deleting tags...');
    await db.delete(tagsTable);
    console.log('Tags deleted');
    console.log('Deleting posts...');
    await db.delete(postsTable);
    console.log('Posts deleted');
    console.log('Deleting users...');
    await db.delete(usersTable);
    console.log('Users deleted');
    console.log('Database cleaned up');
}

const seedDatabase = async () => {
    console.log('Seeding database...');

    console.log(`Seeding ${USER_COUNT} users...`);
    const users = await Promise.all(
        Array.from({ length: USER_COUNT }, () => createUser(createRandomUser()))
    );
    console.log(`Users seeded: ${users.length}`);

    console.log(`Seeding ${POST_COUNT} posts...`);
    const posts = await Promise.all(
        Array.from({ length: POST_COUNT }, () =>
            createPost(createRandomPost(users[createRandomInteger(0, users.length - 1)].id))
        )
    );
    console.log(`Posts seeded: ${posts.length}`);

    console.log(`Seeding tags (fixed: ${FIXED_TAG_NAMES.join(', ')} + ${RANDOM_TAG_COUNT} random)...`);
    const fixedTagNames = [...FIXED_TAG_NAMES];
    const randomTagNames = generateUniqueRandomNames(RANDOM_TAG_COUNT, fixedTagNames);
    const allTagNames = [...fixedTagNames, ...randomTagNames];
    // 一次 batch insert 全部 tag，避免 N 次往返 + 撞 unique 风险
    const tags = await db
        .insert(tagsTable)
        .values(allTagNames.map(name => ({ name })))
        .returning();
    console.log(
        `Tags seeded: ${tags.length} (fixed: ${fixedTagNames.length}, random: ${randomTagNames.length})`,
    );

    console.log('Seeding posts tags...');
    const uniquePairs = new Set<string>();
    const postsTagsPayload: InsertPostsTags[] = [];
    for (const post of posts) {
        const tagCount = createRandomInteger(POST_TAGS_MIN, POST_TAGS_MAX);
        let safety = 0;
        while (postsTagsPayload.filter(p => p.postId === post.id).length < tagCount && safety < tagCount * 5) {
            const tagId = tags[createRandomInteger(0, tags.length - 1)].id;
            const key = `${post.id}-${tagId}`;
            safety++;
            if (uniquePairs.has(key)) continue;
            uniquePairs.add(key);
            postsTagsPayload.push(createRandomPostsTags(post.id, tagId));
        }
    }
    await Promise.all(postsTagsPayload.map(p => createPostsTags(p)));
    console.log(`Posts tags seeded: ${postsTagsPayload.length}`);

    console.log('Database seeded');
}

const main = async () => {
    await cleanDatabase();
    await seedDatabase();
}

main();
