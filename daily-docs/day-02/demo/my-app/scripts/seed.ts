import 'dotenv/config';
import { InsertPost, InsertPostsTags, InsertTag, InsertTip, InsertUser, postsTable, postsTagsTable, SelectPost, SelectTag, SelectUser, tagsTable, tipsTable, usersTable } from "@/db/schema";   
import { db } from "@/db";
import { faker } from '@faker-js/faker';
import { createPost, createPostsTags, createTag, createTip, createUser } from '@/db/queries/insert';


export function createRandomUser(): InsertUser {
    return {
        name: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 65 }),
        email: `email-${faker.string.uuid()}@example.com`,
    };
}

export function createRandomPost(userId: SelectUser['id']): InsertPost {
    return {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: userId,
    };
}

export function createRandomTag(userId: SelectUser['id']): InsertTag {
    return {
        content: faker.lorem.word(),
        userId: userId,
    };
}

export function createRandomTip(tagId: SelectTag['id']): InsertTip {
    return {
        content: faker.lorem.sentence(),
        tagId: tagId,
    };
}

export function createRandomPostsTags(postId: SelectPost['id'], tagId: SelectTag['id']): InsertPostsTags {
    return {
        postId: postId,
        tagId: tagId,
    };
}

export function createRandomInteger(min: number, max: number): number {
    return faker.number.int({ min: min, max: max });
}

const cleanDatabase = async () => {
    console.log('Cleaning up database...');
    console.log('Deleting posts tags...');
    await db.delete(postsTagsTable);
    console.log('Posts tags deleted');
    console.log('Database cleaned up');
    console.log('Deleting tips...');
    await db.delete(tipsTable);
    console.log('Tips deleted');
    console.log('Deleting tags...');
    await db.delete(tagsTable);
    console.log('Tags deleted');
    console.log('Deleting posts...');
    await db.delete(postsTable);
    console.log('Deleting users...');
    console.log('Posts deleted');
    await db.delete(usersTable);
    console.log('Users deleted');
    console.log('Database cleaned up');
}

const seedDatabase = async () => {
    console.log('Seeding database...');
    console.log('Seeding users...');
    const users = await Promise.all(Array.from({ length: 50 }, () => createUser(createRandomUser())));
    console.log('Users seeded');
    console.log('Seeding posts...');
    const posts = await Promise.all(Array.from({ length: 100 }, () => createPost(createRandomPost(users[createRandomInteger(0, users.length - 1)].id))));
    console.log('Posts seeded');        
    console.log('Seeding tags...');
    const tags = await Promise.all(Array.from({ length: 200 }, () => createTag(createRandomTag(users[createRandomInteger(0, users.length - 1)].id))));
    console.log('Tags seeded');
    console.log('Seeding tips...');
    const tips = await Promise.all(Array.from({ length: 300 }, () => createTip(createRandomTip(tags[createRandomInteger(0, tags.length - 1)].id))));
    console.log('Tips seeded');
    console.log('Seeding posts tags...');
    let uniqueTags = new Set<string>();
    const postsTags =  await Promise.all(posts.map(post => {
        return Array.from({ length: createRandomInteger(1, 5) }, () => {
            let tagId = tags[createRandomInteger(0, tags.length - 1)].id;
            while(uniqueTags.has(`${post.id}-${tagId}`)) {
                tagId = tags[createRandomInteger(0, tags.length - 1)].id;
            }
            createPostsTags(createRandomPostsTags(post.id, tagId))
        })
    }))
    console.log('Posts tags seeded');
    console.log('Database seeded');
}

const main = async () => {
    await cleanDatabase()
    await seedDatabase()
}

main()