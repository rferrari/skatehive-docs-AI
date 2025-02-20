import 'animate.css';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function Chat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'error', content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [userId] = useState(() => `user_${Math.random().toString(36).slice(2)}`); // Unique ID per session
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    async function checkConfiguration() {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            user_id: userId
          })
        });
        const data = await response.json();
        setIsConfigured(!data.error?.includes('Supabase is not configured'));
      } catch (error) {
        console.error('Config check error:', error);
        setIsConfigured(false);
      }
    }
    checkConfiguration();
  }, [userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          user_id: userId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: formatMessage(data.response)
      }]);

      // // Adicionar fontes se disponíveis
      // if (data.sources?.length > 0) {
      //   setMessages(prev => [...prev, {
      //     role: 'assistant',
      //     content: `Sources:\n${data.sources.join('\n')}`
      //   }]);
      // }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Chat error:', errorMessage);
      setMessages(prev => [...prev, {
        role: 'error',
        content: errorMessage
      }]);
    } finally {
      setLoading(false);
    }
  }

  function formatMessage(text: string) {
    return text.trim();
  }

  if (isConfigured === false) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-lg mx-auto">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Setup Required</h2>
        <p className="text-yellow-700 mb-4">
          To use the AI chat feature, you need to connect to Supabase and configure OpenAI:
        </p>
        <ol className="list-decimal list-inside text-yellow-700 space-y-2">
          <li>Click the "Connect to Supabase" button in the top right</li>
          <li>Add your OpenAI API key to the environment variables</li>
          <li>Refresh the page</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh] max-w-3xl bg-gray-900 text-gray-100 rounded-lg shadow-lg mx-auto">
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 
                    bg-gradient-to-b from-gray-800/50 to-gray-900/50">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`p-3 md:p-4 rounded-2xl shadow-xl backdrop-blur-sm 
                        w-[85%] sm:w-[75%] md:max-w-[70%]
                        ${message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                  : message.role === 'error'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white'
                    : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200'
                } 
                        animate__animated animate__fadeIn animate__faster`}
            >
              <ReactMarkdown className="prose prose-invert prose-sm md:prose-base break-words">
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-3 md:p-4 
                          rounded-2xl animate-pulse w-[85%] sm:w-[75%] md:max-w-[70%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit}
        className="p-3 md:p-4 bg-gray-800/90 rounded-b-lg border-t border-gray-700">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-3 rounded-lg bg-gray-700/50 text-gray-100 
                     placeholder-gray-400 focus:outline-none focus:ring-2 
                     focus:ring-blue-500 border border-gray-600 text-sm md:text-base
                     transition-all duration-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 
                     to-blue-700 hover:from-blue-500 hover:to-blue-600 
                     disabled:opacity-50 text-white font-medium text-sm md:text-base
                     transition duration-300 ease-in-out transform hover:scale-105
                     focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg
                     w-full sm:w-auto"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
