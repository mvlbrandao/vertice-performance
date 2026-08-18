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

/**
 * Uma chamada só pra assinar várias fotos, em vez de uma por atleta — o
 * mesmo problema de N consultas que computePlayerScores já resolveu pro
 * score, só que pra storage.
 */
export async function resolveSignedUrls(
  bucket: "athlete-photos" | "athlete-media",
  paths: (string | null)[],
  expiresIn = ONE_HOUR,
): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter((p): p is string => !!p))];
  const resultado = new Map<string, string>();
  if (unicos.length === 0) return resultado;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unicos, expiresIn);
  if (error || !data) return resultado;

  for (const item of data) {
    if (item.path && item.signedUrl) resultado.set(item.path, item.signedUrl);
  }
  return resultado;
}
