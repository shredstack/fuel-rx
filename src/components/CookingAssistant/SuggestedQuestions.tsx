interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  compact?: boolean;
}

export function SuggestedQuestions({
  questions,
  onSelect,
  compact,
}: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(question)}
            className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded-full transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pb-3 pt-2 border-t shrink-0">
      <p className="text-xs text-gray-500 mb-2 font-medium">
        Quick questions:
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(question)}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
