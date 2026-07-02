import React from 'react';
import { motion } from 'motion/react';

interface PageSkeletonProps {
  pathname: string;
}

export function PageSkeleton({ pathname }: PageSkeletonProps) {
  // Common shimmering animation settings
  const pulseProps = {
    animate: {
      opacity: [1, 0.5, 1],
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as any,
    },
  };

  // 1. Dashboard skeleton layout
  if (pathname === '/' || pathname === '/dashboard') {
    return (
      <div className="space-y-6 select-none animate-fadeIn">
        {/* Title area */}
        <div className="flex justify-between items-center pb-2">
          <div className="space-y-2">
            <motion.div {...pulseProps} className="h-6 w-48 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            <motion.div {...pulseProps} className="h-4 w-64 bg-gray-150 dark:bg-slate-850 rounded-lg" />
          </div>
          <motion.div {...pulseProps} className="h-10 w-36 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>

        {/* 4 Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <motion.div {...pulseProps} className="h-4 w-20 bg-gray-100 dark:bg-slate-800 rounded" />
                <motion.div {...pulseProps} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800" />
              </div>
              <motion.div {...pulseProps} className="h-7 w-28 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              <div className="flex gap-2">
                <motion.div {...pulseProps} className="h-3.5 w-12 bg-gray-100 dark:bg-slate-850 rounded" />
                <motion.div {...pulseProps} className="h-3.5 w-16 bg-gray-100 dark:bg-slate-850 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts & Interactive Content layout blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-6 shadow-sm">
            <div className="flex justify-between items-center">
              <motion.div {...pulseProps} className="h-5 w-36 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              <div className="flex gap-2">
                <motion.div {...pulseProps} className="h-8 w-16 bg-gray-100 dark:bg-slate-800 rounded-lg" />
                <motion.div {...pulseProps} className="h-8 w-16 bg-gray-100 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
            {/* Chart Area */}
            <div className="h-64 flex items-end gap-3 pt-4 border-b border-gray-100 dark:border-slate-800">
              {[...Array(12)].map((_, idx) => {
                const heightPercent = [40, 60, 80, 50, 90, 30, 70, 85, 45, 65, 55, 75][idx];
                return (
                  <motion.div
                    key={idx}
                    {...pulseProps}
                    style={{ height: `${heightPercent}%` }}
                    className="flex-1 bg-gradient-to-t from-[#B3803E]/10 to-[#B3803E]/30 dark:from-[#B3803E]/5 dark:to-[#B3803E]/20 rounded-t-md"
                  />
                );
              })}
            </div>
          </div>

          {/* Quick lists layout */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
            <motion.div {...pulseProps} className="h-5 w-32 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <motion.div {...pulseProps} className="w-10 h-10 rounded-full bg-gray-150 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <motion.div {...pulseProps} className="h-4 w-28 bg-gray-200 dark:bg-slate-800 rounded" />
                    <motion.div {...pulseProps} className="h-3 w-16 bg-gray-100 dark:bg-slate-850 rounded" />
                  </div>
                  <motion.div {...pulseProps} className="h-4 w-12 bg-gray-150 dark:bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Reports skeleton layout
  if (pathname.startsWith('/reports')) {
    return (
      <div className="space-y-6 select-none animate-fadeIn">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-2 border-b border-gray-100 dark:border-slate-850">
          <div className="space-y-2">
            <motion.div {...pulseProps} className="h-6 w-56 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            <motion.div {...pulseProps} className="h-4 w-72 bg-gray-150 dark:bg-slate-850 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <motion.div {...pulseProps} className="h-10 w-24 bg-gray-200 dark:bg-slate-800 rounded-xl" />
            <motion.div {...pulseProps} className="h-10 w-24 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        {/* Tab filters skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i} {...pulseProps} className="h-9 w-28 bg-gray-100 dark:bg-slate-800 rounded-xl flex-shrink-0" />
          ))}
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-2">
                <motion.div {...pulseProps} className="h-3.5 w-24 bg-gray-100 dark:bg-slate-800 rounded" />
                <motion.div {...pulseProps} className="h-6 w-32 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              </div>
              <motion.div {...pulseProps} className="w-10 h-10 rounded-xl bg-gray-100/80 dark:bg-slate-850" />
            </div>
          ))}
        </div>

        {/* Large report document overview block */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-6 shadow-sm">
          <div className="flex justify-between items-center">
            <motion.div {...pulseProps} className="h-5 w-40 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            <motion.div {...pulseProps} className="h-4 w-28 bg-gray-150 dark:bg-slate-850 rounded" />
          </div>

          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="flex justify-between p-3 border-b border-gray-50 dark:border-slate-850/40">
                <div className="flex items-center gap-3">
                  <motion.div {...pulseProps} className="w-6 h-6 rounded bg-gray-100 dark:bg-slate-800" />
                  <motion.div {...pulseProps} className="h-4 w-32 bg-gray-150 dark:bg-slate-800 rounded" />
                </div>
                <div className="flex gap-6">
                  <motion.div {...pulseProps} className="h-4 w-24 bg-gray-150 dark:bg-slate-800 rounded hidden sm:block" />
                  <motion.div {...pulseProps} className="h-4 w-16 bg-gray-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. POS layout skeleton
  if (pathname.includes('/pos')) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none animate-fadeIn h-[calc(100vh-130px)] min-h-[500px]">
        {/* Left/Right Column splits - Products catalog (7 columns in lg) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex gap-3 items-center">
            {/* Search input placeholder */}
            <motion.div {...pulseProps} className="h-10 flex-1 bg-gray-150 dark:bg-slate-850 rounded-xl" />
            {/* Category drawer btn */}
            <motion.div {...pulseProps} className="w-10 h-10 bg-gray-150 dark:bg-slate-850 rounded-xl" />
          </div>

          {/* Categories Horizontal flow */}
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div key={i} {...pulseProps} className="h-9 w-20 bg-gray-100 dark:bg-slate-800 rounded-xl flex-shrink-0" />
            ))}
          </div>

          {/* Catalog items bento grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl space-y-2">
                <motion.div {...pulseProps} className="h-24 w-full bg-gray-100 dark:bg-slate-850 rounded-lg" />
                <motion.div {...pulseProps} className="h-4 w-3/4 bg-gray-200 dark:bg-slate-800 rounded" />
                <div className="flex justify-between items-center">
                  <motion.div {...pulseProps} className="h-4 w-12 bg-gray-150 dark:bg-slate-800 rounded" />
                  <motion.div {...pulseProps} className="h-3 w-8 bg-gray-100 dark:bg-slate-850 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Cart receipt placeholder (5 columns in lg) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-850 pb-3">
              <motion.div {...pulseProps} className="h-5 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              <motion.div {...pulseProps} className="h-4 w-12 bg-gray-100 dark:bg-slate-850 rounded" />
            </div>

            {/* Cart Items list */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-xl bg-gray-50/50 dark:bg-slate-850/20">
                  <div className="flex-1 space-y-2">
                    <motion.div {...pulseProps} className="h-4 w-32 bg-gray-200 dark:bg-slate-800 rounded" />
                    <motion.div {...pulseProps} className="h-3 w-16 bg-gray-150 dark:bg-slate-850 rounded" />
                  </div>
                  <motion.div {...pulseProps} className="h-8 w-20 bg-gray-150 dark:bg-slate-800 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing totals block */}
          <div className="space-y-3 border-t border-gray-100 dark:border-slate-850 pt-5 mt-6">
            <div className="flex justify-between">
              <motion.div {...pulseProps} className="h-4 w-20 bg-gray-100 dark:bg-slate-800 rounded" />
              <motion.div {...pulseProps} className="h-4 w-16 bg-gray-150 dark:bg-slate-800 rounded" />
            </div>
            <div className="flex justify-between">
              <motion.div {...pulseProps} className="h-5 w-24 bg-gray-200 dark:bg-slate-850 rounded-lg" />
              <motion.div {...pulseProps} className="h-5 w-20 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <motion.div {...pulseProps} className="h-11 w-full bg-[#B3803E]/20 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 4. Default modular table list page skeletons (Inventory, Sales, Customers, Journal, etc.)
  return (
    <div className="space-y-5 select-none animate-fadeIn">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-850">
        <div className="space-y-2">
          <motion.div {...pulseProps} className="h-6 w-40 bg-gray-200 dark:bg-slate-800 rounded-lg" />
          <motion.div {...pulseProps} className="h-3.5 w-60 bg-gray-150 dark:bg-slate-850 rounded-lg" />
        </div>
        <motion.div {...pulseProps} className="h-10 w-28 bg-[#B3803E]/20 dark:bg-[#B3803E]/10 rounded-xl" />
      </div>

      {/* Filter and search blocks */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-3 shadow-sm">
        <motion.div {...pulseProps} className="h-10 flex-1 bg-gray-150 dark:bg-slate-850 rounded-xl" />
        <motion.div {...pulseProps} className="h-10 w-32 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* Grid of cards or tabular list depending on content */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-3.5 shadow-sm">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center p-3.5 border-b border-gray-50 dark:border-slate-850/30 last:border-0">
            <div className="flex items-center gap-3.5">
              <motion.div {...pulseProps} className="w-10 h-10 rounded-xl bg-gray-150 dark:bg-slate-850" />
              <div className="space-y-2">
                <motion.div {...pulseProps} className="h-4.5 w-36 bg-gray-200 dark:bg-slate-800 rounded" />
                <motion.div {...pulseProps} className="h-3.5 w-24 bg-gray-150 dark:bg-slate-850 rounded" />
              </div>
            </div>
            <div className="flex gap-4">
              <motion.div {...pulseProps} className="h-4.5 w-20 bg-gray-150 dark:bg-slate-800 rounded hidden sm:block" />
              <motion.div {...pulseProps} className="h-4.5 w-16 bg-gray-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
