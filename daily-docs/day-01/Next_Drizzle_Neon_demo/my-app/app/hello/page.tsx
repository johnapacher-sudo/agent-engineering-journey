import Demo from "@/component/demo";
import { create, getData } from "./action";
export default  async function Hello() {
  const data = await getData();
  return <div>
    Hello {data}
    <div>
      <Demo />
    </div>
  </div>;
}