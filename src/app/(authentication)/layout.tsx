import { getCurrentUser } from "@/auth/server";
import { redirect } from "next/navigation";
import { PropsWithChildren } from "react";

export default async function AuthenticationLayout({ children }: PropsWithChildren) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/home");
  }

  return <>{children}</>;
}
