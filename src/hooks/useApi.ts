/**
 * useApi Hook
 * Generic hook for API calls with loading, error, and data states
 */

import { useState, useEffect, useCallback } from 'react';
import type { ApiError } from '../api/client';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

interface UseApiOptions {
  immediate?: boolean; // Whether to fetch immediately on mount
  dependencies?: unknown[]; // Dependencies to trigger refetch
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  reset: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Hook for making API calls with automatic state management
 *
 * @example
 * const { data, loading, error, refetch } = useApi(() => requestsAPI.getRequests());
 *
 * @example
 * const { data, loading, execute } = useApi(() => requestsAPI.createRequest(formData), { immediate: false });
 * // Later: await execute();
 */
export function useApi<T>(
  apiCall: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const { immediate = true, dependencies = [] } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiCall();
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const apiError: ApiError = err instanceof Error
        ? { message: err.message, status: 0, details: {} }
        : (err as ApiError);
      setState({ data: null, loading: false, error: apiError });
    }
  }, [apiCall]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const setData = useCallback((value: React.SetStateAction<T | null>) => {
    setState((prev) => ({
      ...prev,
      data: typeof value === 'function' ? (value as (prev: T | null) => T | null)(prev.data) : value,
    }));
  }, []);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  return {
    ...state,
    refetch: fetchData,
    reset,
    setData,
  };
}

/**
 * Hook for lazy API calls (mutations like POST, PUT, DELETE)
 * Doesn't fetch immediately, provides an execute function
 *
 * @example
 * const { execute, loading, error } = useMutation((data) => requestsAPI.createRequest(data));
 * // Later: await execute(formData);
 */
export function useMutation<TData, TResult>(
  mutationFn: (data: TData) => Promise<TResult>
): {
  execute: (data: TData) => Promise<TResult | null>;
  loading: boolean;
  error: ApiError | null;
  data: TResult | null;
  reset: () => void;
} {
  const [state, setState] = useState<{
    data: TResult | null;
    loading: boolean;
    error: ApiError | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (data: TData): Promise<TResult | null> => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await mutationFn(data);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const apiError: ApiError = err instanceof Error
          ? { message: err.message, status: 0, details: {} }
          : (err as ApiError);
        setState({ data: null, loading: false, error: apiError });
        return null;
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Hook for paginated API calls
 *
 * @example
 * const { data, loading, page, setPage, totalPages } = usePaginatedApi(
 *   (page) => requestsAPI.getRequests({ page, page_size: 10 })
 * );
 */
export function usePaginatedApi<T>(
  apiCall: (page: number) => Promise<{ items: T[]; total: number; page: number; page_size: number; pages: number }>,
  initialPage: number = 1
): {
  data: T[];
  loading: boolean;
  error: ApiError | null;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
} {
  const [page, setPageState] = useState(initialPage);
  const [pageInfo, setPageInfo] = useState({
    pageSize: 10,
    totalPages: 0,
    totalItems: 0,
  });

  const { data, loading, error, refetch } = useApi(
    () => apiCall(page),
    { immediate: true, dependencies: [page] }
  );

  useEffect(() => {
    if (data) {
      setPageInfo({
        pageSize: data.page_size,
        totalPages: data.pages,
        totalItems: data.total,
      });
    }
  }, [data]);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, pageInfo.totalPages || 1)));
  }, [pageInfo.totalPages]);

  return {
    data: data?.items || [],
    loading,
    error,
    page,
    pageSize: pageInfo.pageSize,
    totalPages: pageInfo.totalPages,
    totalItems: pageInfo.totalItems,
    setPage,
    refetch,
  };
}

export default useApi;
