import Link from "next/link";
import { XButton } from "@/components/styles";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <XButton type="primary" className="rounded-full">
      <Link href="/auth/sign-up">Sign up</Link>
    </XButton>
  );
}
