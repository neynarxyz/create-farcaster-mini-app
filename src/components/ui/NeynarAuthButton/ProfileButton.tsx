'use client';

import { useRef, useState } from 'react';
import { useDetectClickOutside } from '~/hooks/useDetectClickOutside';
import { cn } from '~/lib/utils';

export function ProfileButton({
  userData,
  onSignOut,
}: {
  userData?: { fid?: number; pfpUrl?: string; username?: string };
  onSignOut: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDetectClickOutside(ref, () => setShowDropdown(false));

  const name = userData?.username ?? `!${userData?.fid}`;
  const pfpUrl = userData?.pfpUrl ?? 'https://farcaster.xyz/avatar.png';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          'flex items-center gap-3 px-4 py-2 min-w-0 rounded-lg',
          'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100',
          'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-primary'
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pfpUrl}
          alt="Profile"
          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://farcaster.xyz/avatar.png';
          }}
        />
        <span className="text-sm font-medium truncate max-w-[120px]">
          {name ? name : '...'}
        </span>
        <svg
          className={cn(
            'w-4 h-4 transition-transform flex-shrink-0',
            showDropdown && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <button
            onClick={() => {
              onSignOut();
              setShowDropdown(false);
            }}
            className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
