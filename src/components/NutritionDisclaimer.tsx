'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NutritionDisclaimerProps {
  variant?: 'inline' | 'compact';
  className?: string;
}

/**
 * Displays nutrition information disclaimer with citations.
 * Required by Apple App Store Guideline 1.4.1 for apps providing health information.
 *
 * Variants:
 * - inline: Full disclaimer with expandable details (for meal plan screens)
 * - compact: Smaller info button that expands (for Quick Cook results)
 */
export default function NutritionDisclaimer({
  variant = 'inline',
  className = ''
}: NutritionDisclaimerProps) {
  const [expanded, setExpanded] = useState(false);

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          aria-label="Nutrition information sources"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Nutrition info</span>
        </button>

        {expanded && (
          <div className="absolute z-10 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs text-xs text-gray-600">
            <p className="mb-2">
              Nutrition estimates are AI-generated based on general guidelines from:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-2">
              <li>
                <a
                  href="https://www.dietaryguidelines.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline"
                >
                  USDA Dietary Guidelines for Americans
                </a>
              </li>
              <li>
                <a
                  href="https://fdc.nal.usda.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline"
                >
                  USDA FoodData Central
                </a>
              </li>
            </ul>
            <p className="text-gray-500">
              This app provides meal planning assistance, not medical advice.
              Consult a healthcare provider for personalized nutrition guidance.
            </p>
            <button
              onClick={() => setExpanded(false)}
              className="mt-2 text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>About nutrition information</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 space-y-2">
          <p>
            Meal plans and nutrition estimates are AI-generated based on general nutrition
            principles from the following sources:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <a
                href="https://www.dietaryguidelines.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline"
              >
                USDA Dietary Guidelines for Americans (2020-2025)
              </a>
            </li>
            <li>
              <a
                href="https://fdc.nal.usda.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline"
              >
                USDA FoodData Central
              </a>
            </li>
          </ul>
          <p className="text-gray-500 pt-1">
            FuelRx provides meal planning assistance and is not intended as medical advice.
            Actual nutrition values may vary based on specific ingredients and preparation methods.
            Consult a registered dietitian or healthcare provider for personalized nutrition guidance.
          </p>
          <Link
            href="/nutrition-info"
            className="inline-block text-primary-600 underline"
          >
            Learn more about our nutrition methodology
          </Link>
        </div>
      )}
    </div>
  );
}
