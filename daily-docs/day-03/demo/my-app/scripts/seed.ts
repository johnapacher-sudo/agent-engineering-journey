import 'dotenv/config';
import { InsertPost, InsertUser, postsTable, SelectPost, SelectUser, usersTable } from "@/db/schema";   
import { db } from "@/db";
import { faker } from '@faker-js/faker';
import { createPost, createUser } from '@/db/queries/insert';


export function createRandomUser(): InsertUser {
    return {
        userName: faker.person.fullName(),
        email: `email-${faker.string.uuid()}@example.com`,
        password: faker.internet.password(),
    };
}

export function createRandomPost(userId: SelectUser['id']): InsertPost {
    return {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: userId,
    };
}



export function createRandomInteger(min: number, max: number): number {
    return faker.number.int({ min: min, max: max });
}

const cleanDatabase = async () => {
    console.log('Cleaning up database...');
    console.log('Deleting posts...');
    await db.delete(postsTable);
    console.log('Posts deleted');
    // console.log('Deleting users...');
    // await db.delete(usersTable);
    // console.log('Users deleted');
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
    console.log('Database seeded');
}

const main = async () => {
    await cleanDatabase()
    // await seedDatabase()
}

main()