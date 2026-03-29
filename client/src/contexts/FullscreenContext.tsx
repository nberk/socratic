import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface FullscreenContextValue {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  toggleFullscreen: () => void;
}

const FullscreenContext = createContext<FullscreenContextValue>({
  isFullscreen: false,
  setFullscreen: () => {},
  toggleFullscreen: () => {},
});

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);
  const setFullscreen = useCallback((value: boolean) => setIsFullscreen(value), []);
  const value = useMemo(
    () => ({ isFullscreen, setFullscreen, toggleFullscreen }),
    [isFullscreen, setFullscreen, toggleFullscreen]
  );
  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  return useContext(FullscreenContext);
}
