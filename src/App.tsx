import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import './App.css';

interface Message {
  type: 'human' | 'robot';
  content: string;
  id: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    const newUserMessage: Message = {
      type: 'human',
      content: userMessage,
      id: Date.now().toString(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    await generateResponse([...messages, newUserMessage]);
  };

  const generateResponse = async (messageHistory: Message[]) => {
    setLoading(true);
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const stream = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: messageHistory.map(m => ({ role: m.type === 'human' ? 'user' : 'assistant', content: m.content })),
        stream: true,
      });

      let assistantMessage = '';
      let isFirstChunk = true;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          if (isFirstChunk) {
            setLoading(false);
            isFirstChunk = false;
          }
          assistantMessage += content;

          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]?.type === 'robot') {
              newMessages[newMessages.length - 1].content = assistantMessage;
            } else {
              newMessages.push({ type: 'robot', content: assistantMessage, id: Date.now().toString() });
            }
            return newMessages;
          });
        }
      }
      inputRef.current?.focus();
    } catch (err) {
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  const startEdit = (message: Message) => {
    setEditingId(message.id);
    setEditText(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (messageId: string) => {
    if (!editText.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const updatedMessages = messages.slice(0, messageIndex + 1);
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: editText.trim()
    };

    setMessages(updatedMessages);
    setEditingId(null);
    setEditText('');

    await generateResponse(updatedMessages);
  };

  const renderMessage = (message: Message): React.JSX.Element => {
    const isEditing = editingId === message.id;

    return (
      <div key={message.id} className={`message ${message.type}`}>
        {isEditing ? (
          <div className="edit-container">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="edit-textarea"
              autoFocus
            />
            <div className="edit-buttons">
              <button
                onClick={() => saveEdit(message.id)}
                disabled={loading || !editText.trim()}
                className="save-button"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                disabled={loading}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="message-wrapper">
            <div className="message-content">{message.content}</div>
            {message.type === 'human' && (
              <button
                onClick={() => startEdit(message)}
                className="edit-button"
                disabled={loading}
              >
                Edit
              </button>
            )}
            {/*
              <div className="navigation-buttons">
                <button
                  onClick={() => {}}
                  className="nav-button"
                >
                  &lt;
                </button>
                <span className="nav-indicator">
                  0/?
                </span>
                <button
                  onClick={() => {}}
                  className="nav-button"
                >
                  &gt;
                </button>
              </div>
            */}
          </div>
        )}
      </div>
    );
  };

  const renderMessages = (): React.JSX.Element[] => {
    return messages.map(renderMessage);
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="messages">
          {renderMessages()}
          {loading && (
            <div className="message assistant">
              <div className="loading">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          {error && (
            <div className="error-message">
              Error: {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="input-form">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="input-box"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App
