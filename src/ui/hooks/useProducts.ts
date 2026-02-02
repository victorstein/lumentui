import { useState, useMemo, useCallback } from 'react';
import { Product } from './useDaemon.js';

/**
 * View mode for product display
 */
export type ViewMode = 'list' | 'detail';

/**
 * Filter options for product list
 */
export interface FilterOptions {
  availableOnly: boolean;
  searchQuery: string;
}

/**
 * Hook for managing product selection and filtering
 */
export const useProducts = (products: Product[]) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FilterOptions>({
    availableOnly: false,
    searchQuery: '',
  });

  /**
   * Filtered products based on current filters
   */
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by availability
    if (filters.availableOnly) {
      result = result.filter((p) => p.available);
    }

    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.vendor.toLowerCase().includes(query) ||
          p.productType.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [products, filters]);

  /**
   * Currently selected product
   */
  const selectedProduct = useMemo(() => {
    if (filteredProducts.length === 0) {
      return null;
    }

    // Clamp index to valid range
    const clampedIndex = Math.max(
      0,
      Math.min(selectedIndex, filteredProducts.length - 1),
    );
    return filteredProducts[clampedIndex];
  }, [filteredProducts, selectedIndex]);

  /**
   * Navigate to next product
   */
  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (filteredProducts.length === 0) return 0;
      return prev >= filteredProducts.length - 1 ? 0 : prev + 1;
    });
  }, [filteredProducts.length]);

  /**
   * Navigate to previous product
   */
  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => {
      if (filteredProducts.length === 0) return 0;
      return prev <= 0 ? filteredProducts.length - 1 : prev - 1;
    });
  }, [filteredProducts.length]);

  /**
   * Select product by index
   */
  const selectByIndex = useCallback(
    (index: number) => {
      setSelectedIndex(
        Math.max(0, Math.min(index, filteredProducts.length - 1)),
      );
    },
    [filteredProducts.length],
  );

  /**
   * Toggle between list and detail view
   */
  const toggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'detail' : 'list'));
  }, []);

  /**
   * Switch to specific view mode
   */
  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  /**
   * Update filters
   */
  const updateFilters = useCallback((updates: Partial<FilterOptions>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
    }));

    // Reset selection when filters change
    setSelectedIndex(0);
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({
      availableOnly: false,
      searchQuery: '',
    });
    setSelectedIndex(0);
  }, []);

  /**
   * Stats about products
   */
  const stats = useMemo(() => {
    const total = products.length;
    const available = products.filter((p) => p.available).length;
    const unavailable = total - available;
    const filtered = filteredProducts.length;

    return {
      total,
      available,
      unavailable,
      filtered,
      isFiltered:
        filters.availableOnly || filters.searchQuery.trim().length > 0,
    };
  }, [products, filteredProducts, filters]);

  return {
    // State
    selectedIndex,
    selectedProduct,
    viewMode,
    filters,
    filteredProducts,
    stats,

    // Actions
    selectNext,
    selectPrevious,
    selectByIndex,
    toggleView,
    switchView,
    updateFilters,
    clearFilters,
  };
};
