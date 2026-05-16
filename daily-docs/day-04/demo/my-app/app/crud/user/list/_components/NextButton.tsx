'use client';

import { useRouter, useSearchParams } from "next/navigation";


export default function NextButton ({ cursorIndex }: { cursorIndex: number }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const handleClick = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('cursor', String(cursorIndex));
        router.push(`/crud/user/list?${params.toString()}`);
    }
    return (
        <button className='bg-blue-500 text-white px-4 py-2 rounded-md' onClick={handleClick}>
            下一页
        </button>
    )
}
