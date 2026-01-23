'use client';

import type { HealthCategory } from '@/lib/types';

interface HealthScoreBadgeProps {
  score: number;
  category?: HealthCategory;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Get display label for health category
 */
function getCategoryLabel(score: number): string {
  if (score >= 80) return 'Whole Food';
  if (score >= 60) return 'Minimal Processing';
  if (score >= 40) return 'Light Processing';
  return 'Processed';
}

/**
 * Health score indicator badge
 *
 * Displays a colored dot and optional label indicating the health quality of a food:
 * - Green (80-100): Whole foods
 * - Lime (60-79): Minimally processed
 * - Amber (40-59): Lightly processed
 * - Red (0-39): Heavily processed
 */
export default function HealthScoreBadge({
  score,
  showLabel = false,
  size = 'sm',
}: HealthScoreBadgeProps) {
  // Determine colors based on score
  let dotColor: string;
  let bgColor: string;
  let textColor: string;

  if (score >= 80) {
    dotColor = 'bg-green-500';
    bgColor = 'bg-green-50';
    textColor = 'text-green-700';
  } else if (score >= 60) {
    dotColor = 'bg-lime-500';
    bgColor = 'bg-lime-50';
    textColor = 'text-lime-700';
  } else if (score >= 40) {
    dotColor = 'bg-amber-500';
    bgColor = 'bg-amber-50';
    textColor = 'text-amber-700';
  } else {
    dotColor = 'bg-red-500';
    bgColor = 'bg-red-50';
    textColor = 'text-red-700';
  }

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  if (!showLabel) {
    // Just the dot
    return (
      <span
        className={`inline-block ${dotSize} rounded-full ${dotColor}`}
        title={getCategoryLabel(score)}
      />
    );
  }

  // Dot with label
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} ${bgColor} ${textColor} rounded ${fontSize} font-medium`}
    >
      <span className={`${dotSize} rounded-full ${dotColor}`} />
      {getCategoryLabel(score)}
    </span>
  );
}

/**
 * Data type label component
 * Shows the USDA data type (Foundation, Branded, etc.)
 */
export function DataTypeLabel({
  dataType,
  brandOwner,
  size = 'sm',
}: {
  dataType: string;
  brandOwner?: string;
  size?: 'sm' | 'md';
}) {
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';

  // Format the display text
  let displayText = dataType;
  if (dataType === 'Branded' && brandOwner) {
    displayText = brandOwner;
  } else if (dataType === 'SR Legacy') {
    displayText = 'USDA Reference';
  } else if (dataType === 'Foundation') {
    displayText = 'Foundation Foods';
  } else if (dataType === 'Survey (FNDDS)') {
    displayText = 'Survey Data';
  }

  return (
    <span className={`${fontSize} text-gray-500`}>
      {displayText}
    </span>
  );
}
