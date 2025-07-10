// Using built-in fetch (available in Node.js 18+ and Electron 25+)

interface OllamaResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface ExtractedReceiptData {
  vendor: string | null;
  date: string | null;
  amount: number | null;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;
  private isAvailable: boolean = false;

  constructor(baseUrl: string = 'http://127.0.0.1:11434', model: string = 'gemma2:2b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * Check if Ollama is running and the model is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      console.log('Checking Ollama health...');
      
      // Check if Ollama is running
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('Ollama server not responding');
        this.isAvailable = false;
        return false;
      }

      const data = await response.json() as { models: Array<{ name: string }> };
      
      // Check if our model is available
      console.log('Available models:', data.models?.map(m => m.name) || []);
      const hasModel = data.models?.some(model => 
        model.name === this.model || 
        model.name.startsWith(this.model.split(':')[0])
      );
      
      if (!hasModel) {
        console.log(`Model ${this.model} not found. Available models:`, data.models?.map(m => m.name) || []);
        this.isAvailable = false;
        return false;
      }

      console.log(`✓ Ollama is available with model ${this.model}`);
      this.isAvailable = true;
      return true;
      
    } catch (error) {
      console.log('Ollama not available:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Error details:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Extract receipt data using Gemma 2B
   */
  async extractReceiptData(ocrText: string): Promise<ExtractedReceiptData | null> {
    if (!this.isAvailable) {
      console.log('Ollama not available, skipping LLM extraction');
      return null;
    }

    try {
      console.log('=== STARTING LLM EXTRACTION ===');
      console.log('Using model:', this.model);
      console.log('OCR text length:', ocrText.length);

      const prompt = this.createExtractionPrompt(ocrText);
      
      console.log('Sending request to Ollama...');
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.5, // Higher temperature for better generation
            top_p: 0.9,
            num_predict: 500,  // More tokens for complete response
            // Remove stop tokens that might be cutting off the response
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      console.log(`LLM response received in ${responseTime}ms`);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
      console.log('Raw LLM response object:', JSON.stringify(data, null, 2));
      console.log('LLM response text:', data.response);

      // Parse the JSON response
      const extractedData = this.parseExtractionResponse(data.response);
      
      if (extractedData) {
        console.log('✓ LLM extraction successful:', JSON.stringify(extractedData, null, 2));
        console.log('  Vendor type:', typeof extractedData.vendor, 'Value:', extractedData.vendor);
        console.log('  Date type:', typeof extractedData.date, 'Value:', extractedData.date);
        console.log('  Amount type:', typeof extractedData.amount, 'Value:', extractedData.amount);
        return extractedData;
      } else {
        console.log('❌ Failed to parse LLM response');
        console.log('Response was:', data.response);
        return null;
      }

    } catch (error) {
      console.error('❌ LLM extraction error:', error);
      return null;
    }
  }

  /**
   * Create optimized prompt for Gemma 2B
   */
  private createExtractionPrompt(ocrText: string): string {
    // Truncate very long text to avoid token limits but keep more context
    const maxLength = 1500;
    const truncatedText = ocrText.length > maxLength ? 
      ocrText.substring(0, maxLength) + '...' : 
      ocrText;

    // Simpler, more direct prompt for Gemma 2B
    return `Extract vendor, date, and total amount from this receipt.

${truncatedText}

Find:
- vendor: The store name (like Amazon, Walmart, Target). For Amazon look for "Sold by: Amazon"
- date: Order date in format YYYY-MM-DD
- amount: Grand Total (the final price after tax)

Return JSON: {"vendor": "store name", "date": "YYYY-MM-DD", "amount": 99.99}`;
  }

  /**
   * Parse the LLM response to extract structured data
   */
  private parseExtractionResponse(response: string): ExtractedReceiptData | null {
    try {
      // Clean the response - remove any markdown, extra text, etc.
      let cleanResponse = response.trim();
      
      // Look for JSON in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }

      // Try to parse as JSON
      const parsed = JSON.parse(cleanResponse);
      
      // Validate the structure
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          vendor: this.validateString(parsed.vendor),
          date: this.validateDate(parsed.date),
          amount: this.validateAmount(parsed.amount)
        };
      }

      return null;
    } catch (error) {
      console.log('Failed to parse LLM JSON response:', error);
      
      // Try to extract data using regex as fallback
      return this.extractWithRegexFallback(response);
    }
  }

  /**
   * Fallback extraction using regex if JSON parsing fails
   */
  private extractWithRegexFallback(response: string): ExtractedReceiptData | null {
    console.log('Attempting regex fallback extraction...');
    
    const vendorMatch = response.match(/"vendor":\s*"([^"]+)"/i);
    const dateMatch = response.match(/"date":\s*"([^"]+)"/i);
    const amountMatch = response.match(/"amount":\s*([0-9.]+)/i);

    return {
      vendor: vendorMatch ? vendorMatch[1] : null,
      date: dateMatch ? this.validateDate(dateMatch[1]) : null,
      amount: amountMatch ? parseFloat(amountMatch[1]) : null
    };
  }

  /**
   * Validate and clean vendor string
   */
  private validateString(value: any): string | null {
    if (typeof value === 'string' && value.trim().length > 0 && value.toLowerCase() !== 'null') {
      return value.trim();
    }
    return null;
  }

  /**
   * Validate and format date string
   */
  private validateDate(value: any): string | null {
    if (typeof value === 'string' && value.toLowerCase() !== 'null' && value.trim()) {
      // Try to parse various date formats
      const dateStr = value.trim();
      
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return dateStr;
        }
      }
      
      // Try other common formats
      const patterns = [
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/, // MM/DD/YYYY or MM-DD-YYYY
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/,  // MM/DD/YY or MM-DD-YY
        /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,  // YYYY/MM/DD or YYYY-MM-DD
      ];
      
      for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
          let year, month, day;
          
          if (pattern === patterns[0]) { // MM/DD/YYYY
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          } else if (pattern === patterns[1]) { // MM/DD/YY
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = 2000 + parseInt(match[3]);
          } else { // YYYY/MM/DD
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          }
          
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            // Return in YYYY-MM-DD format
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
      
      // Try native Date parsing as last resort
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        // Validate the year is reasonable (between 2000 and 2050)
        if (year >= 2000 && year <= 2050) {
          return `${year}-${month}-${day}`;
        }
      }
    }
    return null;
  }

  /**
   * Validate amount number
   */
  private validateAmount(value: any): number | null {
    if (typeof value === 'number' && value > 0) {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed * 100) / 100;
      }
    }
    return null;
  }

  /**
   * Get service status
   */
  getStatus(): { available: boolean; model: string; baseUrl: string } {
    return {
      available: this.isAvailable,
      model: this.model,
      baseUrl: this.baseUrl
    };
  }

  /**
   * Analyze finances using Gemma 2B
   */
  async analyzeFinances(query: string, context: any): Promise<string | null> {
    if (!this.isAvailable) {
      console.log('Ollama not available for financial analysis');
      return null;
    }

    try {
      console.log('=== FINANCIAL ANALYSIS REQUEST ===');
      console.log('Query:', query);

      const prompt = this.createFinancialAnalysisPrompt(query, context);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 1000, // Allow longer responses for analysis
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
      console.log('Financial analysis complete');

      return data.response || null;

    } catch (error) {
      console.error('Financial analysis error:', error);
      return null;
    }
  }

  /**
   * Create financial analysis prompt
   */
  private createFinancialAnalysisPrompt(query: string, context: any): string {
    return `You are a helpful financial assistant analyzing expense data. Based on the following financial data, answer the user's question in a clear, concise, and helpful manner.

Financial Summary:
- Total Expenses: $${context.totalExpenses}
- Number of Transactions: ${context.numberOfExpenses}
- Average Expense: $${context.averageExpense}

Spending by Category:
${context.expensesByCategory.map((cat: any) => `- ${cat.name}: $${cat.total} (${cat.percentage}%)`).join('\n')}

Recent Expenses:
${context.recentExpenses.slice(0, 5).map((exp: any) => `- ${exp.date}: $${exp.amount} at ${exp.vendor || 'Unknown'} (${exp.category})`).join('\n')}

Monthly Spending Trend:
${context.monthlySpending.slice(0, 3).map((month: any) => `- ${month.month}: $${month.total}`).join('\n')}

Top Vendors:
${context.topVendors.map((vendor: any) => `- ${vendor.vendor}: $${vendor.total}`).join('\n')}

User Question: ${query}

Provide a helpful response that directly answers the question. Include specific numbers and percentages where relevant. If the user asks for advice, provide practical suggestions based on the data.`;
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();