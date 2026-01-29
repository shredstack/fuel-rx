'use client'

interface StepDisplayProps {
  steps: string[]
  currentStep: number
  onPrevious: () => void
  onNext: () => void
  onStepSelect: (step: number) => void
}

export function StepDisplay({
  steps,
  currentStep,
  onPrevious,
  onNext,
  onStepSelect,
}: StepDisplayProps) {
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="flex-1 flex flex-col">
      {/* Step progress indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {steps.map((_, idx) => (
          <button
            key={idx}
            onClick={() => onStepSelect(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              idx === currentStep
                ? 'bg-teal-500 w-6'
                : idx < currentStep
                  ? 'bg-teal-300'
                  : 'bg-gray-300'
            }`}
            aria-label={`Go to step ${idx + 1}`}
          />
        ))}
      </div>

      {/* Current step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <p className="text-xl md:text-2xl leading-relaxed text-gray-800 max-w-2xl">
          {steps[currentStep]}
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={onPrevious}
          disabled={isFirstStep}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            isFirstStep
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <button
          onClick={onNext}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            isLastStep
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-teal-500 hover:bg-teal-600 text-white'
          }`}
        >
          {isLastStep ? (
            <>
              Done Cooking
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          ) : (
            <>
              Next
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
