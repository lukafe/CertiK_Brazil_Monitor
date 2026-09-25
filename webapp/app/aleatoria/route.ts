import { redirect } from "next/navigation";
import { getRandomCnpj } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  redirect(`/inst/${getRandomCnpj()}`);
}
