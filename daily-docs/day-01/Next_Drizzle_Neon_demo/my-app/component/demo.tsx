"use client";

import { useState } from "react";
import { create } from "../app/hello/action";
export default function Demo() {
  const [value, setValue] = useState("");

  const handleClick =async () => {
    console.log("当前 input 的值：", value);
    await create(value);
    alert("创建成功"+ value);
  };

  return (
    <div className="flex items-center gap-2 p-4">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="请输入内容"
        className="rounded border border-gray-300 px-3 py-1 outline-none focus:border-blue-500"
      />
      <button
        type="button"
        onClick={handleClick}
        className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
      >
        打印
      </button>
    </div>
  );
}
