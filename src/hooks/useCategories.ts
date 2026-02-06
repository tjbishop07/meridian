import { useStore } from '../store';

export function useCategories() {
  const categories = useStore((state) => state.categories);
  const loadCategories = useStore((state) => state.loadCategories);

  const getCategoryById = (id: number | null) => {
    if (!id) return null;
    return categories.find((c) => c.id === id);
  };

  const getCategoriesByType = (type: 'income' | 'expense') => {
    return categories.filter((c) => c.type === type);
  };

  return {
    categories,
    loadCategories,
    getCategoryById,
    getCategoriesByType,
  };
}
