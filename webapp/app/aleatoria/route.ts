import { redirect } from "next/navigation";
import cnpjs from "@/lib/cnpjs.json";

export const dynamic = "force-dynamic";

export function GET() {
  redirect(`/inst/${cnpjs[Math.floor(Math.random() * cnpjs.length)]}`);
}
