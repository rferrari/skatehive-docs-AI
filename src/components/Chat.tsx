import React, { useEffect, useState } from 'react';

export function Chat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'error', content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Check if Supabase is configured on component mount
  useEffect(() => {
    async function checkConfiguration() {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        });
        const data = await response.json();
        setIsConfigured(!data.error?.includes('Supabase is not configured'));
      } catch (error) {
        setIsConfigured(false);
      }
    }
    checkConfiguration();
  }, []);

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
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
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

  if (isConfigured === false) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">Setup Required</h2>
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
    <div className="flex flex-col h-[600px] max-h-[80vh] bg-gray-800 text-gray-100 rounded-lg shadow-md">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg ${message.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : message.role === 'error'
                  ? 'bg-red-600 text-white mx-8'
                  : 'bg-gray-700 text-gray-100 mr-8'
              }`}
          >
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="bg-gray-700 p-4 rounded-lg mr-8 animate-pulse">
            <div>Thinking...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-2 flex-col md:flex-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the documentation..."
            className="flex-1 px-4 py-2 border rounded-md bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-2 md:mt-0 md:ml-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-lg transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
