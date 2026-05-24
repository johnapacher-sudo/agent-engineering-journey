import { NextRequest, NextResponse } from "next/server";
import { getUserInfo, type IUserInfoFilter } from "@/db/queries/select";

class BadRequestError extends Error {}

const parseOptionalId = (searchParams: URLSearchParams, key: keyof IUserInfoFilter) => {
    const value = searchParams.get(key);
    if (!value) return undefined;

    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new BadRequestError(`${key} must be a positive integer`);
    }

    return parsedValue;
}

const buildUserInfoFilter = (searchParams: URLSearchParams): IUserInfoFilter => {
    return { 
        userId: parseOptionalId(searchParams, "userId"), 
        postId: parseOptionalId(searchParams, "postId"), 
        tagId: parseOptionalId(searchParams, "tagId"), 
    };
}

const handleUserListRequest = async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const filter = buildUserInfoFilter(searchParams);
        const userList = await getUserInfo(filter);
        return NextResponse.json({
            data: userList
        });
    } catch (error) {
        const isBadRequest = error instanceof BadRequestError;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch user list" },
            { status: isBadRequest ? 400 : 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handleUserListRequest(request);
}

export async function POST(request: NextRequest) {
    return handleUserListRequest(request);
}

export const runtime = 'edge';