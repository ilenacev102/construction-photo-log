/**
 * Pure batch-upload decisions for PhotoUpload — no DOM, no React.
 *
 * A batch is "finished" when every item reached `done`/`queued`/`error`.
 * Items that failed (or never ran) must survive the batch so the field worker
 * can retry them; the photo is already stored server-side, so a retry must not
 * re-post /api/upload.
 */

export type BatchStatus = 'pending' | 'uploading' | 'done' | 'queued' | 'error'

export interface BatchItemLike {
  id: number
  status: BatchStatus
  /** Set once /api/upload returned a stored photo. */
  photoId?: string | null
  /** Label ids already applied to `photoId` (avoids duplicate taggings on retry). */
  taggedLabelIds?: string[]
}

/** Items kept in the list after a batch run: failures and anything unfinished. */
export function retainAfterBatch<T extends BatchItemLike>(items: readonly T[]): T[] {
  return items.filter(
    (i) => i.status === 'error' || i.status === 'pending' || i.status === 'uploading',
  )
}

/**
 * What a retry of `item` must do: re-upload only when no photo id is known,
 * and re-tag only the labels that were never applied.
 */
export function planRetry(
  item: Pick<BatchItemLike, 'photoId' | 'taggedLabelIds'>,
  labelIds: string[],
): { upload: boolean; labelIds: string[] } {
  const tagged = item.taggedLabelIds ?? []
  return {
    upload: !item.photoId,
    labelIds: labelIds.filter((id) => !tagged.includes(id)),
  }
}
