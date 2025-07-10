import React, { useState, useRef, useEffect } from 'react';
import { Expense, Category } from '../../shared/types';
import { api } from '../services/ipc-service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  expenses: Expense[];
  categories: Category[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ expenses, categories }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const analyzeFinances = async (query: string): Promise<string> => {
    // Prepare financial context
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expensesByCategory = categories.map(cat => {
      const categoryExpenses = expenses.filter(exp => exp.category === cat.id);
      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      return {
        name: cat.name,
        total,
        count: categoryExpenses.length,
        percentage: totalExpenses > 0 ? (total / totalExpenses * 100).toFixed(1) : '0'
      };
    }).filter(cat => cat.count > 0);

    // Get recent expenses
    const recentExpenses = expenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Calculate monthly spending
    const monthlySpending = expenses.reduce((acc, exp) => {
      const month = exp.date.substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);

    // Top vendors
    const vendorSpending = expenses.reduce((acc, exp) => {
      if (exp.vendor && exp.vendor !== 'Unknown') {
        acc[exp.vendor] = (acc[exp.vendor] || 0) + exp.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const topVendors = Object.entries(vendorSpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Create context for the AI
    const context = {
      totalExpenses: totalExpenses.toFixed(2),
      numberOfExpenses: expenses.length,
      expensesByCategory,
      recentExpenses: recentExpenses.map(exp => ({
        date: exp.date,
        amount: exp.amount,
        vendor: exp.vendor,
        category: categories.find(c => c.id === exp.category)?.name || 'Unknown'
      })),
      monthlySpending: Object.entries(monthlySpending).map(([month, total]) => ({
        month,
        total: total.toFixed(2)
      })),
      topVendors: topVendors.map(([vendor, total]) => ({
        vendor,
        total: total.toFixed(2)
      })),
      averageExpense: expenses.length > 0 ? (totalExpenses / expenses.length).toFixed(2) : '0'
    };

    try {
      const response = await api.ai.analyzeFinances(query, context);
      if (response.success && response.data) {
        return response.data;
      } else {
        return "I apologize, but I'm having trouble analyzing your financial data right now. Please try again.";
      }
    } catch (error) {
      console.error('Error analyzing finances:', error);
      // Provide a basic response when AI is not available
      const lowerQuery = query.toLowerCase();
      
      if (lowerQuery.includes('spending') && lowerQuery.includes('categor')) {
        if (expensesByCategory.length === 0) {
          return "You don't have any expenses recorded yet. Start adding expenses to see your spending by category.";
        }
        const topCategories = expensesByCategory
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
          .map(cat => `${cat.name}: $${cat.total.toFixed(2)} (${cat.percentage}%)`)
          .join('\n');
        
        return `Your top spending categories are:\n\n${topCategories}\n\nTotal expenses: $${totalExpenses.toFixed(2)}`;
      }
      
      if (lowerQuery.includes('vendor')) {
        if (topVendors.length === 0) {
          return "No vendor data available yet. Make sure to add vendor information when recording expenses.";
        }
        const vendorList = topVendors
          .map(([vendor, total], i) => `${i + 1}. ${vendor}: $${total.toFixed(2)}`)
          .join('\n');
        
        return `Your top vendors are:\n\n${vendorList}`;
      }
      
      if (lowerQuery.includes('average')) {
        return `Your average expense is $${context.averageExpense} across ${context.numberOfExpenses} transactions.`;
      }
      
      return `You have ${context.numberOfExpenses} expenses totaling $${totalExpenses.toFixed(2)}. Try asking about spending categories, monthly trends, or top vendors for more specific insights.`;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await analyzeFinances(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const suggestedQuestions = [
    "What are my top spending categories?",
    "How much did I spend last month?",
    "What are my most frequent vendors?",
    "Show me my spending trends",
    "Where can I reduce expenses?"
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <h1 className="ai-title">AI Financial Assistant</h1>
        <p className="ai-subtitle">Ask questions about your expenses and get insights</p>
      </div>

      <div className="chat-container">
        {messages.length === 0 ? (
          <div className="welcome-state">
            <div className="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7V12C2 16.5 5 20.7 12 22C19 20.7 22 16.5 22 12V7L12 2Z" />
                <path d="M12 22V2" />
                <path d="M8 10L12 14L16 10" />
              </svg>
            </div>
            <h2>Welcome to your AI Financial Assistant</h2>
            <p>I can help you analyze your expenses, identify spending patterns, and provide insights about your financial data.</p>
            
            <div className="suggested-grid">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  className="suggested-card"
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  <span className="suggested-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      <circle cx="12" cy="12" r="5" />
                    </svg>
                  </span>
                  <span className="suggested-text">{question}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages-area">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.role === 'assistant' && (
                  <div className="message-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                )}
                <div className="message-bubble">
                  <div className="message-content">{message.content}</div>
                  <div className="message-time">{formatTime(message.timestamp)}</div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="message-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="input-area">
          <div className="input-container">
            <button type="button" className="attach-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            
            <button type="button" className="emoji-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
            
            <button type="button" className="file-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </button>
            
            <textarea
              ref={inputRef}
              className="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type here..."
              rows={1}
              disabled={isLoading}
            />
            
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="send-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;