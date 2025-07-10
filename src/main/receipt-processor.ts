import * as Tesseract from 'tesseract.js';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { db } from './ipc-handlers';
import pdf2pic from 'pdf2pic';
import * as pdfParse from 'pdf-parse';
import { ollamaService } from './ollama-service';

export async function processReceiptFile(filePath: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('=== STARTING RECEIPT PROCESSING ===');
    console.log('File path:', filePath);
    console.log('File size:', fs.statSync(filePath).size, 'bytes');
    console.log('File extension:', path.extname(filePath).toLowerCase());
    
    // Create receipt record first
    const receiptId = uuidv4();
    const filename = path.basename(filePath);
    const uploadsDir = path.join(app.getPath('userData'), 'uploads');
    const processedDir = path.join(uploadsDir, 'processed');
    
    console.log('Receipt ID:', receiptId);
    console.log('Uploads directory:', uploadsDir);
    
    // Ensure directories exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // Copy file to uploads directory
    const permanentPath = path.join(uploadsDir, `${receiptId}_${filename}`);
    fs.copyFileSync(filePath, permanentPath);
    console.log('File copied to:', permanentPath);
    
    // Insert receipt record
    const insertReceipt = db.prepare(`
      INSERT INTO receipts (id, filename, original_path, status)
      VALUES (?, ?, ?, 'processing')
    `);
    insertReceipt.run(receiptId, filename, permanentPath);
    console.log('Receipt record created in database');
    
    // Process the receipt
    const result = await processReceipt(receiptId, permanentPath);
    
    if (result.success) {
      console.log('=== RECEIPT PROCESSING COMPLETED SUCCESSFULLY ===');
      console.log('Receipt ID:', receiptId);
      console.log('Extracted data summary:', {
        amount: result.extractedData?.amount,
        vendor: result.extractedData?.vendor,
        date: result.extractedData?.date,
        confidence: result.extractedData?.confidence
      });
      console.log('Created expense:', result.expense ? {
        id: result.expense.id,
        amount: result.expense.amount,
        vendor: result.expense.vendor,
        date: result.expense.date,
        description: result.expense.description
      } : 'No expense created');
      
      return { 
        success: true, 
        data: { 
          receiptId,
          expense: result.expense,
          extractedData: result.extractedData
        }
      };
    } else {
      console.log('=== RECEIPT PROCESSING FAILED ===');
      console.log('Error:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('=== RECEIPT PROCESSING ERROR ===');
    console.error('Error processing receipt file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process receipt' 
    };
  }
}

async function processReceipt(receiptId: string, filePath: string): Promise<{ success: boolean; expense?: any; extractedData?: any; error?: string }> {
  try {
    console.log('--- Processing Receipt:', receiptId, '---');
    
    // Update status to processing
    const updateStatus = db.prepare('UPDATE receipts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateStatus.run('processing', receiptId);

    const fileExtension = path.extname(filePath).toLowerCase();
    let ocrText = '';
    let processedPath = '';

    console.log('File extension detected:', fileExtension);

    if (fileExtension === '.pdf') {
      console.log('Processing PDF file...');
      // Handle PDF files - extract text first, then fallback to OCR if needed
      const pdfResult = await processPDF(filePath);
      ocrText = pdfResult.text;
      processedPath = pdfResult.imagePath;
      console.log('PDF processing result:');
      console.log('- Text length:', ocrText.length);
      console.log('- First 200 characters:', ocrText.substring(0, 200));
      console.log('- Processed path:', processedPath);
    } else {
      console.log('Processing image file...');
      // Handle image files with enhanced OCR
      processedPath = await preprocessImage(filePath);
      console.log('Image preprocessed to:', processedPath);
      
      // Perform OCR
      const ocrResult = await performOCR(processedPath);
      ocrText = ocrResult.text;
      console.log('OCR processing result:');
      console.log('- Text length:', ocrText.length);
      console.log('- Confidence:', ocrResult.confidence);
      console.log('- First 200 characters:', ocrText.substring(0, 200));
    }

    console.log('--- Starting Data Extraction ---');
    console.log('Raw text length:', ocrText.length);
    
    // Save raw text to debug file for analysis
    const debugDir = path.join(app.getPath('userData'), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFilePath = path.join(debugDir, `${receiptId}_raw_text.txt`);
    fs.writeFileSync(debugFilePath, ocrText);
    console.log('Raw text saved to:', debugFilePath);

    // Check if Ollama is available and initialize if needed
    const isOllamaReady = await ollamaService.checkHealth();
    console.log('Ollama service status:', ollamaService.getStatus());

    const extractedData = await extractReceiptDataWithGemma(ocrText, isOllamaReady);

    console.log('--- Data Extraction Complete ---');
    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

    // Update receipt with OCR results
    const updateReceipt = db.prepare(`
      UPDATE receipts 
      SET ocr_text = ?, extracted_data = ?, processed_path = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateReceipt.run(ocrText, JSON.stringify(extractedData), processedPath, receiptId);
    console.log('Receipt database record updated');

    // Automatically create expense from extracted data
    console.log('--- Creating Expense from Extracted Data ---');
    const expense = await createExpenseFromExtractedData(extractedData, receiptId);

    if (expense) {
      console.log('Expense created successfully:');
      console.log('- ID:', expense.id);
      console.log('- Amount:', expense.amount);
      console.log('- Vendor:', expense.vendor);
      console.log('- Date:', expense.date);
      console.log('- Description:', expense.description);
    } else {
      console.log('No expense was created (insufficient data)');
    }

    console.log(`--- Receipt ${receiptId} processed successfully ---`);
    return { success: true, expense, extractedData };
    
  } catch (error) {
    console.error(`=== ERROR processing receipt ${receiptId} ===`);
    console.error('Error details:', error);
    
    const updateStatus = db.prepare('UPDATE receipts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateStatus.run('failed', receiptId);
    
    return { success: false, error: error instanceof Error ? error.message : 'Processing failed' };
  }
}

async function preprocessImage(imagePath: string): Promise<string> {
  const processedDir = path.join(app.getPath('userData'), 'uploads', 'processed');
  const filename = path.basename(imagePath, path.extname(imagePath)) + '_processed.png';
  const processedPath = path.join(processedDir, filename);

  try {
    // Get image metadata first to determine best processing approach
    const metadata = await sharp(imagePath).metadata();
    console.log(`Image metadata: ${metadata.width}x${metadata.height}, density: ${metadata.density}`);

    // Enhanced preprocessing pipeline optimized for receipt text
    let pipeline = sharp(imagePath);

    // Optimal resize for OCR (aim for 300-600 DPI equivalent)
    const targetWidth = metadata.width && metadata.width < 1800 ? metadata.width * 2 : 1800;
    pipeline = pipeline.resize(targetWidth, null, { 
      withoutEnlargement: true,
      fit: 'inside',
      kernel: sharp.kernel.lanczos3 // Better quality for text
    });

    // Advanced noise reduction and enhancement
    pipeline = pipeline
      .median(2) // Gentle noise reduction
      .modulate({ 
        brightness: 1.1, // Slightly brighter
        saturation: 0.8, // Reduce color saturation
        hue: 0 
      })
      .normalize({ lower: 5, upper: 95 }) // Better contrast normalization
      .linear(1.3, -(128 * 1.3) + 128) // Increase contrast more aggressively
      .grayscale()
      .sharpen({ 
        sigma: 1.5, // Optimal sharpening for text
        m1: 0.7, 
        m2: 3, 
        x1: 3, 
        y2: 15, 
        y3: 25 
      })
      .threshold(120) // Slightly lower threshold for better text capture
      .png({ quality: 100, compressionLevel: 1 });

    await pipeline.toFile(processedPath);

    console.log(`Image preprocessed successfully: ${processedPath}`);
    return processedPath;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    // Fallback to simpler but still effective processing
    await sharp(imagePath)
      .resize(1600, null, { withoutEnlargement: true, fit: 'inside' })
      .grayscale()
      .normalize()
      .linear(1.2, -(128 * 1.2) + 128)
      .sharpen()
      .threshold(130)
      .png()
      .toFile(processedPath);
    
    return processedPath;
  }
}

async function performOCR(imagePath: string): Promise<{ text: string; confidence: number }> {
  try {
    // Enhanced OCR configuration optimized for receipts
    const ocrConfig = {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR: ${m.status} - ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,/:- ()#&@',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      preserve_interword_spaces: '1',
      tessedit_create_hocr: '1',
      tessedit_create_pdf: '0',
      tessedit_create_tsv: '0',
      // Receipt-specific optimizations
      tessedit_write_images: '0',
      classify_bln_numeric_mode: '1',
      textord_really_old_xheight: '1',
      segment_penalty_dict_frequent_word: '1',
      segment_penalty_dict_case_ok: '1',
      segment_penalty_dict_case_bad: '1.3125',
      // Improve number recognition
      classify_integer_matcher_multiplier: '10',
      classify_enable_learning: '0'
    };

    const result = await Tesseract.recognize(imagePath, 'eng', ocrConfig);
    
    return {
      text: result.data.text,
      confidence: result.data.confidence || 0
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw error;
  }
}

async function extractReceiptDataWithGemma(ocrText: string, useLLM: boolean = true): Promise<any> {
  console.log('=== GEMMA 2B EXTRACTION PIPELINE ===');
  console.log('OCR text length:', ocrText.length);
  console.log('LLM available:', useLLM);
  
  let extractedData: any = {
    confidence: 0.5,
    items: [],
    rawText: ocrText,
    vendor: null,
    date: null,
    amount: null
  };

  // Primary extraction: Use Gemma 2B if available
  if (useLLM) {
    console.log('Step 1: Using Gemma 2B for accurate extraction...');
    
    try {
      const llmData = await ollamaService.extractReceiptData(ocrText);
      
      if (llmData) {
        console.log('✓ Gemma 2B extraction returned data:');
        console.log('  Raw LLM response:', JSON.stringify(llmData, null, 2));
        console.log('  Vendor:', llmData.vendor || 'NOT FOUND');
        console.log('  Date:', llmData.date || 'NOT FOUND');
        console.log('  Amount:', llmData.amount ? `$${llmData.amount}` : 'NOT FOUND');
        
        // Use all LLM results - but preserve null values
        if (llmData.vendor !== null && llmData.vendor !== undefined) {
          extractedData.vendor = llmData.vendor;
        }
        if (llmData.date !== null && llmData.date !== undefined) {
          extractedData.date = llmData.date;
        }
        if (llmData.amount !== null && llmData.amount !== undefined) {
          extractedData.amount = llmData.amount;
        }
        
        extractedData.confidence = 0.9; // High confidence for LLM results
        console.log('  Extracted data after LLM:', JSON.stringify(extractedData, null, 2));
      } else {
        console.log('⚠ Gemma 2B extraction returned null/undefined, falling back to simple patterns...');
        // Only use simple extraction as fallback if LLM completely fails
        extractedData = trySimpleExtraction(ocrText);
      }
    } catch (error) {
      console.log('❌ Gemma 2B extraction error:', error);
      console.log('Error details:', error instanceof Error ? error.stack : 'Unknown error');
      console.log('Falling back to simple extraction...');
      extractedData = trySimpleExtraction(ocrText);
    }
  } else {
    console.log('⚠ Gemma 2B not available, using simple extraction fallback...');
    extractedData = trySimpleExtraction(ocrText);
  }
  
  console.log('=== PRE-VALIDATION DATA ===');
  console.log('Before validation:', JSON.stringify(extractedData, null, 2));
  
  // Final validation and cleanup
  extractedData = validateAndCleanExtractedData(extractedData);
  
  console.log('=== FINAL EXTRACTION RESULTS ===');
  console.log('Method used:', useLLM ? 'Gemma 2B' : 'Simple Regex Fallback');
  console.log('Final extracted data:', JSON.stringify(extractedData, null, 2));
  console.log('Vendor:', extractedData.vendor || 'None');
  console.log('Date:', extractedData.date || 'None');
  console.log('Amount:', extractedData.amount ? `$${extractedData.amount}` : 'None');
  console.log('Confidence:', extractedData.confidence);
  
  return extractedData;
}

function trySimpleExtraction(ocrText: string): any {
  console.log('=== EMERGENCY SIMPLE EXTRACTION ===');
  console.log('⚠ This is a fallback when Gemma 2B is not available');
  
  const lines = ocrText.split('\n').filter(line => line.trim().length > 0);
  const extractedData: any = {
    confidence: 0.3, // Low confidence for fallback
    items: [],
    rawText: ocrText,
    vendor: null,
    date: null,
    amount: null
  };

  console.log(`Processing ${lines.length} lines with basic patterns`);
  
  // Very basic patterns - just enough to extract something
  const amountRegex = /(?:total|amount)[\s:]*\$?(\d{1,4}(?:\.\d{2})?)/i;
  const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;
  
  // Try to find amount
  const amountMatch = ocrText.match(amountRegex);
  if (amountMatch) {
    extractedData.amount = parseFloat(amountMatch[1]);
    console.log('Basic amount found:', extractedData.amount);
  }
  
  // Try to find date
  const dateMatch = ocrText.match(dateRegex);
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      extractedData.date = parsed.toISOString().split('T')[0];
      console.log('Basic date found:', extractedData.date);
    }
  }
  
  // Try to find vendor from first line
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 2 && firstLine.length < 50 && 
        !/^\d+$/.test(firstLine) && 
        !/^\$/.test(firstLine)) {
      extractedData.vendor = firstLine;
      console.log('Basic vendor found:', extractedData.vendor);
    }
  }

  console.log('⚠ Simple extraction complete - results may be inaccurate');
  return extractedData;
}

function validateAndCleanExtractedData(data: any): any {
  console.log('=== VALIDATING EXTRACTED DATA ===');
  console.log('Input data:', JSON.stringify(data, null, 2));
  
  // Clean and validate vendor
  const originalVendor = data.vendor;
  if (data.vendor && typeof data.vendor === 'string') {
    data.vendor = data.vendor.trim();
    console.log(`Vendor validation: "${originalVendor}" -> "${data.vendor}"`);
    
    if (data.vendor.length < 2) {
      console.log(`  Vendor too short (${data.vendor.length} chars), setting to null`);
      data.vendor = null;
    } else if (data.vendor.toLowerCase() === 'null' || data.vendor.toLowerCase() === 'unknown') {
      console.log(`  Vendor is "${data.vendor}", setting to null`);
      data.vendor = null;
    }
  } else {
    console.log(`Vendor is not a string or is null/undefined:`, data.vendor);
  }
  
  // Validate date format
  const originalDate = data.date;
  if (data.date && typeof data.date === 'string') {
    console.log(`Date validation: "${originalDate}"`);
    
    // Check if it's in YYYY-MM-DD format and is a valid date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      console.log(`  Date not in YYYY-MM-DD format, setting to null`);
      data.date = null;
    } else {
      const date = new Date(data.date);
      if (isNaN(date.getTime())) {
        console.log(`  Date is invalid when parsed, setting to null`);
        data.date = null;
      } else {
        console.log(`  Date is valid: ${data.date}`);
      }
    }
  } else {
    console.log(`Date is not a string or is null/undefined:`, data.date);
  }
  
  // Validate amount
  const originalAmount = data.amount;
  if (data.amount !== null && data.amount !== undefined) {
    console.log(`Amount validation: ${originalAmount} (type: ${typeof originalAmount})`);
    
    if (typeof data.amount === 'string') {
      data.amount = parseFloat(data.amount);
      console.log(`  Parsed string to float: ${data.amount}`);
    }
    
    if (isNaN(data.amount)) {
      console.log(`  Amount is NaN, setting to null`);
      data.amount = null;
    } else if (data.amount <= 0) {
      console.log(`  Amount is <= 0, setting to null`);
      data.amount = null;
    } else if (data.amount > 10000) {
      console.log(`  Amount > 10000, setting to null`);
      data.amount = null;
    } else {
      data.amount = Math.round(data.amount * 100) / 100; // Round to 2 decimal places
      console.log(`  Amount is valid: ${data.amount}`);
    }
  } else {
    console.log(`Amount is null/undefined:`, data.amount);
  }
  
  // Calculate confidence based on what we found
  let confidence = 0.5;
  if (data.amount) confidence += 0.3;
  if (data.vendor) confidence += 0.2;
  if (data.date) confidence += 0.1;
  
  data.confidence = confidence;
  
  console.log('=== VALIDATION COMPLETE ===');
  console.log('Output data:', JSON.stringify(data, null, 2));
  console.log('Summary:');
  console.log('  Vendor valid:', !!data.vendor, `(${data.vendor || 'null'})`);
  console.log('  Date valid:', !!data.date, `(${data.date || 'null'})`);
  console.log('  Amount valid:', !!data.amount, `(${data.amount || 'null'})`);
  console.log('  Final confidence:', confidence);
  
  return data;
}

async function createExpenseFromExtractedData(extractedData: any, receiptId: string): Promise<any> {
  try {
    console.log('=== CREATING EXPENSE FROM EXTRACTED DATA ===');
    console.log('Input extracted data:', JSON.stringify(extractedData, null, 2));
    
    // Only create expense if we have a valid amount
    if (!extractedData.amount || extractedData.amount <= 0) {
      console.log(`❌ Skipping expense creation for receipt ${receiptId}: no valid amount found (amount: ${extractedData.amount})`);
      return null;
    }

    const expenseId = uuidv4();
    console.log('Generated expense ID:', expenseId);
    
    // Smart categorization - find or create appropriate category
    const description = extractedData.vendor 
      ? `Purchase at ${extractedData.vendor}` 
      : 'Receipt purchase';
    console.log('Generated description:', description);
    
    // For now, use a default category or create one based on vendor
    let categoryId = await getOrCreateCategory(extractedData.vendor || 'Other');
    console.log('Category ID:', categoryId);
    
    // Process the date
    const expenseDate = extractedData.date 
      ? formatDate(extractedData.date) 
      : new Date().toISOString().split('T')[0];
    console.log('Date processing:');
    console.log('  Raw date from extraction:', extractedData.date);
    console.log('  Formatted date for database:', expenseDate);
    
    // Process the vendor with validation
    let vendorForDb = extractedData.vendor || 'Unknown';
    
    // Validate vendor - reject obvious non-vendor strings
    const invalidVendorPatterns = [
      /^order\s*details?$/i,
      /^ship\s*to$/i,
      /^bill\s*to$/i,
      /^invoice$/i,
      /^receipt$/i,
      /^thank\s*you$/i,
      /^customer\s*copy$/i,
      /^page\s*\d+$/i
    ];
    
    if (vendorForDb !== 'Unknown') {
      const isInvalid = invalidVendorPatterns.some(pattern => pattern.test(vendorForDb));
      if (isInvalid) {
        console.log(`⚠ Invalid vendor detected: "${vendorForDb}", using Unknown`);
        vendorForDb = 'Unknown';
      }
    }
    
    console.log('Vendor processing:');
    console.log('  Raw vendor from extraction:', extractedData.vendor);
    console.log('  Validated vendor for database:', vendorForDb);
    
    const tags = JSON.stringify(['receipt-import', 'auto-created']);
    console.log('Tags:', tags);

    // Create expense from total amount
    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, amount, description, category, date, vendor, tags, receipt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    console.log('Executing database insert with values:');
    console.log('  ID:', expenseId);
    console.log('  Amount:', extractedData.amount);
    console.log('  Description:', description);
    console.log('  Category ID:', categoryId);
    console.log('  Date:', expenseDate);
    console.log('  Vendor:', vendorForDb);
    console.log('  Tags:', tags);
    console.log('  Receipt ID:', receiptId);

    insertExpense.run(
      expenseId,
      extractedData.amount,
      description,
      categoryId,
      expenseDate,
      vendorForDb,
      tags,
      receiptId
    );
    
    console.log('✓ Database insert completed');

    // Return the created expense with category info
    const expense = db.prepare(`
      SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM expenses e
      LEFT JOIN categories c ON e.category = c.id
      WHERE e.id = ?
    `).get(expenseId);

    console.log('--- EXPENSE RETRIEVAL FROM DATABASE ---');
    console.log('Retrieved expense from database:', JSON.stringify(expense, null, 2));
    
    // Verify the vendor and date are correctly stored
    if (expense) {
      console.log('✓ Expense created successfully');
      console.log('  Database ID:', (expense as any).id);
      console.log('  Database amount:', (expense as any).amount);
      console.log('  Database vendor:', (expense as any).vendor);
      console.log('  Database date:', (expense as any).date);
      console.log('  Database description:', (expense as any).description);
    } else {
      console.log('❌ Failed to retrieve expense from database');
    }

    console.log(`=== EXPENSE CREATION COMPLETE ===`);
    return expense;
    
  } catch (error) {
    console.error(`=== ERROR creating expense from receipt ${receiptId} ===`);
    console.error('Error details:', error);
    return null;
  }
}

async function getOrCreateCategory(vendorName: string): Promise<string> {
  // Mapping of vendors to categories
  const vendorCategoryMap: { [key: string]: { name: string; color: string; icon: string } } = {
    'walmart': { name: 'Groceries', color: '#28a745', icon: 'G' },
    'target': { name: 'Retail', color: '#dc3545', icon: 'R' },
    'kroger': { name: 'Groceries', color: '#28a745', icon: 'G' },
    'starbucks': { name: 'Coffee & Dining', color: '#fd7e14', icon: 'C' },
    'mcdonalds': { name: 'Restaurants', color: '#fd7e14', icon: 'R' },
    'shell': { name: 'Gas & Fuel', color: '#ffc107', icon: 'F' },
    'exxon': { name: 'Gas & Fuel', color: '#ffc107', icon: 'F' },
    'amazon': { name: 'Online Shopping', color: '#ff9900', icon: 'O' },
    'uber': { name: 'Transportation', color: '#6f42c1', icon: 'T' },
    'doordash': { name: 'Food Delivery', color: '#dc3545', icon: 'D' }
  };

  const vendor = vendorName.toLowerCase();
  let categoryData = vendorCategoryMap[vendor];
  
  // Check if vendor name contains any of the mapped vendors
  if (!categoryData) {
    for (const [key, value] of Object.entries(vendorCategoryMap)) {
      if (vendor.includes(key)) {
        categoryData = value;
        break;
      }
    }
  }
  
  // Default category if no match
  if (!categoryData) {
    categoryData = { name: 'Other', color: '#6c757d', icon: 'O' };
  }

  // Check if category already exists
  const existingCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryData.name) as { id: string } | undefined;
  
  if (existingCategory) {
    return existingCategory.id;
  }
  
  // Create new category
  const categoryId = uuidv4();
  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, color, icon, category_type)
    VALUES (?, ?, ?, ?, 'traditional')
  `);
  
  insertCategory.run(categoryId, categoryData.name, categoryData.color, categoryData.icon);
  return categoryId;
}

function formatDate(dateString: string): string {
  try {
    console.log(`formatDate called with: "${dateString}"`);
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Try to parse the date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;
      console.log(`✓ formatDate success: "${dateString}" -> "${formatted}"`);
      return formatted;
    }
    
    // If parsing fails, return today's date
    const fallback = new Date().toISOString().split('T')[0];
    console.log(`⚠ formatDate using fallback: "${dateString}" -> "${fallback}"`);
    return fallback;
    
  } catch (error) {
    const fallback = new Date().toISOString().split('T')[0];
    console.log(`❌ formatDate error: "${dateString}" -> "${fallback}", error:`, error);
    return fallback;
  }
}

async function processPDF(pdfPath: string): Promise<{ text: string; imagePath: string }> {
  try {
    // First, try to extract text directly from PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse.default(pdfBuffer);
    
    if (pdfData.text && pdfData.text.trim().length > 50) {
      // PDF has extractable text, use it directly
      console.log('PDF text extracted directly');
      return {
        text: pdfData.text,
        imagePath: pdfPath // Keep original PDF path
      };
    }
    
    // PDF doesn't have extractable text or has very little text
    // Convert PDF to images and use OCR
    console.log('Converting PDF to images for OCR...');
    
    const processedDir = path.join(app.getPath('userData'), 'uploads', 'processed');
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    const filename = path.basename(pdfPath, path.extname(pdfPath));

    const convert = pdf2pic.fromPath(pdfPath, {
      density: 200,           // Higher density for better OCR
      saveFilename: `${filename}_page`,
      savePath: processedDir,
      format: "png",
      width: 1200,           // Good width for OCR
      height: 1600           // Good height for receipts
    });

    // Convert first page only for now
    console.log('Processing first page of PDF');
    
    try {
      const result = await convert(1);
      
      if (!result || !result.path) {
        throw new Error('Failed to convert PDF page to image');
      }

      // Run OCR on the converted image
      const ocrResult = await Tesseract.recognize(result.path, 'eng', {
        logger: m => console.log(`PDF OCR: ${m.status}`)
      });

      return {
        text: ocrResult.data.text,
        imagePath: result.path
      };
      
    } catch (pageError) {
      console.error('Error processing PDF page:', pageError);
      throw new Error('Failed to process PDF page');
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    // Return minimal result instead of throwing
    return {
      text: 'PDF processing failed - please try with an image file',
      imagePath: pdfPath
    };
  }
}