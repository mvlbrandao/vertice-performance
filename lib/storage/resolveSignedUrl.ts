import "server-only";
import { createClient } from "@/lib/supabase/server";

const ONE_HOUR = 60 * 60;

export async function resolveSignedUrl(
  bucket: "athlete-photos" | "athlete-media",
  path: string | null,
  expiresIn = ONE_HOUR,
): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
