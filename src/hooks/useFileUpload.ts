import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { UploadedFile } from "@/hooks/useDeclarationFlow";

const BUCKET = "declaration-files";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const ALLOWED_EXT = /\.(pdf|png|jpe?g|webp)$/i;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return "Fichier trop volumineux (max 20 Mo)";
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.test(file.name))
    return "Format non autorisé (PDF, PNG, JPG, WEBP)";
  return null;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

export function useFileUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const uploadOne = useCallback(
    async (
      file: File,
      declarationId: string,
    ): Promise<{ storagePath: string; dbId: string }> => {
      if (!user) throw new Error("Non authentifié");
      const path = `${user.id}/${declarationId}/${Date.now()}_${safeName(file.name)}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: dbErr } = await supabase
        .from("declaration_files")
        .insert({
          declaration_id: declarationId,
          file_name: file.name,
          file_type: file.type,
          storage_path: path,
          size_bytes: file.size,
        })
        .select("id")
        .single();
      if (dbErr || !row) {
        // best-effort cleanup
        await supabase.storage.from(BUCKET).remove([path]);
        throw dbErr ?? new Error("Insertion declaration_files échouée");
      }
      return { storagePath: path, dbId: row.id };
    },
    [user],
  );

  const removeOne = useCallback(async (file: UploadedFile) => {
    if (file.storagePath) {
      await supabase.storage.from(BUCKET).remove([file.storagePath]);
    }
    if (file.dbId) {
      await supabase.from("declaration_files").delete().eq("id", file.dbId);
    }
  }, []);

  return { uploadOne, removeOne, uploading, setUploading };
}
