import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const THRESHOLD = 75; // Squeeze peak triggering point
  const RESISTANCE = 0.45; // Drag dampening factor

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Check if user is at the top of the container / page to allow pull-to-refresh
      if (window.scrollY === 0 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        setIsPulling(true);
      } else {
        setIsPulling(false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing || window.scrollY > 0) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;
      
      if (diff > 0) {
        // Prevent scroll default when pulling
        if (e.cancelable) {
          e.preventDefault();
        }
        const dist = Math.min(diff * RESISTANCE, 120);
        setPullDistance(dist);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;
      setIsPulling(false);

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);
        
        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default elegant simulation + hard reload to complete system synchronization
            await new Promise((resolve) => setTimeout(resolve, 1000));
            window.location.reload();
          }
        } catch (err) {
          console.error("Refresh error:", err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    // Desktop support (Mouse events)
    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startYRef.current = e.clientY;
        isMouseDown = true;
        setIsPulling(true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !isPulling || isRefreshing || window.scrollY > 0) return;
      const currentY = e.clientY;
      const diff = currentY - startYRef.current;
      if (diff > 0) {
        const dist = Math.min(diff * RESISTANCE, 120);
        setPullDistance(dist);
      }
    };

    const handleMouseUp = async () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      setIsPulling(false);

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);
        
        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default elegant refresh fallback
            await new Promise((resolve) => setTimeout(resolve, 900));
            window.location.reload();
          }
        } catch (err) {
          console.error("Refresh error:", err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    const element = containerRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd);
      
      // Desktop listeners to make it premium on all screens
      element.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('mousedown', handleMouseDown);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [pullDistance, isPulling, isRefreshing, onRefresh]);

  // Rotational value corresponding to current drag depth
  const rotation = (pullDistance / THRESHOLD) * 360;

  return (
    <div ref={containerRef} className="relative w-full min-h-screen select-none">
      
      {/* Pull down indicator overlay */}
      <AnimatePresence>
        {(pullDistance > 10 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-0 right-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{ 
              top: `${Math.max(5, pullDistance - 45)}px`,
              height: '40px'
            }}
          >
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-full shadow-lg">
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : { rotate: rotation }}
                transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0.1 }}
                className="text-primary"
              >
                <RefreshCw className="w-4 h-4 text-secondary dark:text-amber-500" />
              </motion.div>
              
              <span className="text-[10px] font-sans font-black text-gray-700 dark:text-gray-200">
                {isRefreshing 
                  ? 'جاري التحديث والمزامنة...' 
                  : pullDistance >= THRESHOLD 
                    ? 'أفلت للتحديث السريع!' 
                    : 'اسحب للأسفل للتحديث'
                }
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Page Layout Content Wrapper */}
      <div 
        style={
          (pullDistance > 0 || isRefreshing)
            ? { 
                transform: `translateY(${isRefreshing ? 50 : pullDistance * 0.5}px)`,
                transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              }
            : undefined
        }
        className="w-full h-full"
      >
        {children}
      </div>
    </div>
  );
}
