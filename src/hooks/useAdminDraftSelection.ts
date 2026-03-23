import { useEffect, useState } from 'react';

type DraftLike = { id: string };

/**
 * Default-select first draft when list is non-empty; clear when empty; fall back to first if current id disappears.
 */
export function useAdminDraftSelection(drafts: DraftLike[]) {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (drafts.length === 0) {
      setSelectedDraftId(null);
      return;
    }
    const firstId = drafts[0].id;
    setSelectedDraftId((prev) => {
      if (!prev) return firstId;
      if (!drafts.some((d) => d.id === prev)) return firstId;
      return prev;
    });
  }, [drafts]);

  return [selectedDraftId, setSelectedDraftId] as const;
}
