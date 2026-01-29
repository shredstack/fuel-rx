import type { CookingChatMessage } from '@/lib/types';

interface ChatMessageProps {
  message: CookingChatMessage;
  compact?: boolean;
}

export function ChatMessage({ message, compact }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        } ${
          isUser
            ? 'bg-teal-500 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        <p className={`${compact ? 'text-sm' : 'text-[15px]'} leading-relaxed whitespace-pre-wrap break-words`}>
          {message.content}
        </p>
      </div>
    </div>
  );
}
