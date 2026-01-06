'use client';

interface TestModeBannerProps {
  testMode: string | null;
}

export default function TestModeBanner({ testMode }: TestModeBannerProps) {
  // Don't render if not in test mode or if mode is production
  if (!testMode || testMode === 'production') {
    return null;
  }

  const modeDescriptions: Record<string, string> = {
    'fixture': 'Instant mock data (no API calls)',
    'haiku-minimal': '1 day repeated with Haiku',
    'haiku-full': 'Full 7 days with Haiku',
    'sonnet-minimal': '1 day with Sonnet',
  };

  const description = modeDescriptions[testMode] || testMode;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
      <span className="font-bold">Test Mode:</span> {testMode} — {description}
      <span className="ml-2 text-amber-800">(unset MEAL_PLAN_TEST_MODE for production behavior)</span>
    </div>
  );
}
