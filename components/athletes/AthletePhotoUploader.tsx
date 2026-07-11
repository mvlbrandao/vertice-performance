"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAthletePhoto } from "@/lib/storage/upload";
import { setAthletePhotoPath } from "@/lib/actions/photo";
import { initials } from "@/lib/utils/initials";

export function AthletePhotoUploader({
  athleteId,
  clubId,
  fullName,
  photoColor,
  signedPhotoUrl,
}: {
  athleteId: string;
  clubId: string;
  fullName: string;
  photoColor: string | null;
  signedPhotoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setPreviewUrl(URL.createObjectURL(file));

    const { path, error: uploadError } = await uploadAthletePhoto(clubId, athleteId, file);
    if (uploadError || !path) {
      setUploading(false);
      setError(uploadError ?? "Falha no upload.");
      return;
    }
    const result = await setAthletePhotoPath(athleteId, path);
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const displayUrl = previewUrl ?? signedPhotoUrl;

  return (
    <div className="relative w-16 h-16 shrink-0">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={fullName} className="w-16 h-16 rounded-xl object-cover" />
      ) : (
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center font-display text-[26px]"
          style={{ background: photoColor ?? "#111", color: "#FFD600" }}
        >
          {initials(fullName)}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Alterar foto"
        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-pitch-dark text-amber text-[11px] flex items-center justify-center border-2 border-white disabled:opacity-60"
      >
        {uploading ? "…" : "📷"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {error && (
        <div className="absolute top-full left-0 mt-1 text-[11px] text-clay whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
