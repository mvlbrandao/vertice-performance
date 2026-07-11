import { createClient } from "@/lib/supabase/client";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

export function athletePhotoPath(clubId: string, athleteId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  return `${clubId}/${athleteId}/photo.${ext}`;
}

export function exerciseVideoPath(
  clubId: string,
  athleteId: string,
  exerciseId: string,
  file: File,
) {
  const ext = file.name.split(".").pop() || "mp4";
  return `${clubId}/${athleteId}/exercises/${exerciseId}/${Date.now()}.${ext}`;
}

export function mediaItemPath(clubId: string, athleteId: string, file: File) {
  const ext = file.name.split(".").pop() || "bin";
  return `${clubId}/${athleteId}/media/${Date.now()}.${ext}`;
}

export async function uploadAthletePhoto(
  clubId: string,
  athleteId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "Envie um arquivo de imagem." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Imagem muito grande (máx. 5MB)." };

  const supabase = createClient();
  const path = athletePhotoPath(clubId, athleteId, file);
  const { error } = await supabase.storage
    .from("athlete-photos")
    .upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  return { path };
}

export async function uploadExerciseVideo(
  clubId: string,
  athleteId: string,
  exerciseId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith("video/")) return { error: "Envie um arquivo de vídeo." };
  if (file.size > MAX_VIDEO_BYTES) return { error: "Vídeo muito grande (máx. 100MB)." };

  const supabase = createClient();
  const path = exerciseVideoPath(clubId, athleteId, exerciseId, file);
  const { error } = await supabase.storage.from("athlete-media").upload(path, file);
  if (error) return { error: error.message };
  return { path };
}

export async function uploadMediaItem(
  clubId: string,
  athleteId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const isVideo = file.type.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
  if (!isVideo && !file.type.startsWith("image/")) {
    return { error: "Envie uma imagem ou um vídeo." };
  }
  if (file.size > maxBytes) return { error: "Arquivo muito grande." };

  const supabase = createClient();
  const path = mediaItemPath(clubId, athleteId, file);
  const { error } = await supabase.storage.from("athlete-media").upload(path, file);
  if (error) return { error: error.message };
  return { path };
}
