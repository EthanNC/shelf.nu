import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logout } from "~/modules/auth/lucia.server";

import { assertIsPost } from "~/utils/http.server";

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const cookie = await logout(request);
  return cookie;
}

export function loader() {
  return redirect("/");
}
