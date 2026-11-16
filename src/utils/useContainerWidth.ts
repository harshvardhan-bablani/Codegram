import { useEffect, useRef, useState } from 'react';

export function useContainerWidth(defaultWidth = 680) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(defaultWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
