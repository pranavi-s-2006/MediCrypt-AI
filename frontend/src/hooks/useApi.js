import { useState, useEffect, useCallback } from 'react'

export function useApi(fn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fn()
      setData(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { run() }, [run])

  return { data, loading, error, refresh: run }
}

export function extractError(err) {
  if (!err) return 'An unexpected error occurred.'
  const detail = err.response?.data?.detail
  if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ')
  if (typeof detail === 'string') return detail
  if (err.message === 'Network Error') return 'Cannot reach the server. Check your connection or ensure the backend is running.'
  if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.'
  return err.message || 'An unexpected error occurred.'
}
