"use server";

import { revalidatePath } from "next/cache";
import { updateCommentStatus } from "@/src/lib/comments/store";

export async function publishCommentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await updateCommentStatus(id, "published");
  }
  revalidatePath("/admin/comments");
}

export async function hideCommentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await updateCommentStatus(id, "hidden");
  }
  revalidatePath("/admin/comments");
}
