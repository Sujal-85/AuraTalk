import { useState, useRef, useEffect } from 'react';
import { axiosInstance } from '../lib/axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const suggestions = [
  "What is your name?",
  "How are you?",
  "What can you do?",
  "What is the weather today?",
  "Tell me a joke.",
];

const AIChatModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setSuggestion('');
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (input) {
      const foundSuggestion = suggestions.find(s => s.toLowerCase().startsWith(input.toLowerCase()));
      if (foundSuggestion && foundSuggestion.toLowerCase() !== input.toLowerCase()) {
        setSuggestion(foundSuggestion);
      } else {
        setSuggestion('');
      }
    } else {
      setSuggestion('');
    }
  }, [input]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSuggestion('');
    setLoading(true);
    try {
      const res = await axiosInstance.post('/ai-chat', { message: input });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.response }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not get a response.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      setInput(suggestion);
      setSuggestion('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md relative flex flex-col max-h-[90vh]">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl" onClick={onClose}>&times;</button>
        <div className="p-4 border-b font-bold text-lg text-center">AI Chat</div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ minHeight: 200 }}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] text-sm bg-gray-200 text-gray-900`}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content)) }}
                />
              ) : (
                <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm bg-blue-500 text-white`}>{msg.content}</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex items-center gap-2 p-4 border-t">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring bg-transparent"
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
            />
            {suggestion && (
              <div className="absolute inset-y-0 left-0 px-3 py-2 text-sm text-gray-400 pointer-events-none">
                <span className="invisible">{input}</span>
                <span>{suggestion.substring(input.length)}</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={loading || !input.trim()}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatModal; 