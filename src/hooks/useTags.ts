import { useState, useCallback } from 'react';
import type { Tag } from '../types';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);

  const loadTags = useCallback(async () => {
    const result = await window.electron.invoke('tags:get-all');
    setTags(result);
  }, []);

  const createTag = useCallback(async (data: { name: string; color: string }) => {
    await window.electron.invoke('tags:create', data);
    const result = await window.electron.invoke('tags:get-all');
    setTags(result);
  }, []);

  const updateTag = useCallback(async (data: { id: number; name?: string; color?: string }) => {
    await window.electron.invoke('tags:update', data);
    const result = await window.electron.invoke('tags:get-all');
    setTags(result);
  }, []);

  const deleteTag = useCallback(async (id: number) => {
    await window.electron.invoke('tags:delete', id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setTagsForTransaction = useCallback(async (transactionId: number, tagIds: number[]) => {
    await window.electron.invoke('tags:set-for-transaction', transactionId, tagIds);
  }, []);

  return { tags, loadTags, createTag, updateTag, deleteTag, setTagsForTransaction };
}
