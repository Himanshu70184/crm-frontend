'use client';

import { useState } from 'react';
import { getAssetUrl } from '@/lib/api';

// Extracts up to 2 initials from a name ("John Doe" -> "JD", "Rahul" -> "R").
function initialsOf(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Literal Tailwind classes (JIT needs them spelled out in source).
const SIZE_CLASSES = {
  6: 'w-6 h-6',
  7: 'w-7 h-7',
  8: 'w-8 h-8',
  9: 'w-9 h-9',
  10: 'w-10 h-10',
  12: 'w-12 h-12',
  14: 'w-14 h-14',
  16: 'w-16 h-16',
};

const ROUNDED_CLASSES = {
  full: 'rounded-full',
  xl: 'rounded-xl',
  'rounded-xl': 'rounded-xl',
  lg: 'rounded-lg',
  'rounded-lg': 'rounded-lg',
  '2xl': 'rounded-2xl',
};

// Avatar with a graceful fallback.
//
// If `src` is empty the initials block is rendered immediately. If the image
// fails to load (e.g. the uploaded file lives on an ephemeral server disk and
// was wiped, or the URL simply 404s) the component swaps to the initials block
// so the UI never shows a broken-image icon.
export default function Avatar({
  name = '',
  src = '',
  alt = '',
  size = 8, // Tailwind sizing token (w-8 h-8 by default)
  rounded = 'full',
  className = '',
  textClassName = '',
  imgClassName = '',
}) {
  const [failed, setFailed] = useState(false);
  const hasSrc = Boolean(src);
  const showImage = hasSrc && !failed;
  const sizeClass = SIZE_CLASSES[size] || 'w-8 h-8';
  const radiusClass = ROUNDED_CLASSES[rounded] || 'rounded-full';
  const initials = initialsOf(name);

  if (showImage) {
    return (
      <img
        src={getAssetUrl(src)}
        alt={alt || name}
        onError={() => setFailed(true)}
        className={`${sizeClass} ${radiusClass} object-cover shrink-0 ${imgClassName} ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${radiusClass} flex items-center justify-center text-white font-bold shrink-0 ${textClassName} ${className}`}
      style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
    >
      {initials || '?'}
    </div>
  );
}

