'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the value after it has stayed unchanged for the given delay
 * (300ms by default). Used on search inputs so typing does not fire
 * one API request per keystroke.
 */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
