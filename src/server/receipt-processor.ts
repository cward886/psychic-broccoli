import * as Tesseract from 'tesseract.js';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import db, { getOrCreateCategory } from './database';
import pdf2pic from 'pdf2pic';
import * as pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import Fuse from 'fuse.js';

export async function processReceipt(receiptId: string, filePath: string): Promise<void> {
  try {
    const updateStatus = db.prepare('UPDATE receipts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateStatus.run('processing', receiptId);

    const fileExtension = path.extname(filePath).toLowerCase();
    let ocrText = '';
    let processedPath = '';

    if (fileExtension === '.pdf') {
      // Handle PDF files
      const { text, imagePath } = await processPDF(filePath);
      ocrText = text;
      processedPath = imagePath;
    } else {
      // Handle image files with enhanced OCR
      processedPath = await preprocessImage(filePath);
      
      // Try OCR with multiple configurations for better accuracy
      const ocrResult = await performEnhancedOCR(processedPath);
      ocrText = ocrResult.text;
      
      // Validate OCR quality
      const ocrQuality = validateOCRQuality(ocrText);
      console.log(`OCR quality score: ${ocrQuality.score}/10`);
      
      if (ocrQuality.score < 5) {
        console.warn('Low OCR quality detected. Confidence:', ocrQuality.score);
        // Try again with different settings if quality is poor
        const retryResult = await performEnhancedOCR(processedPath, true);
        if (validateOCRQuality(retryResult.text).score > ocrQuality.score) {
          ocrText = retryResult.text;
        }
      }
    }

    const extractedData = extractReceiptData(ocrText);

    const updateReceipt = db.prepare(`
      UPDATE receipts 
      SET ocr_text = ?, extracted_data = ?, processed_path = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateReceipt.run(ocrText, JSON.stringify(extractedData), processedPath, receiptId);

    // Automatically create expense from extracted data
    await createExpenseFromExtractedData(extractedData, receiptId);

    console.log(`Receipt ${receiptId} processed successfully`);
  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    
    const updateStatus = db.prepare('UPDATE receipts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateStatus.run('failed', receiptId);
  }
}

async function preprocessImage(imagePath: string): Promise<string> {
  const processedDir = path.join(process.cwd(), 'uploads', 'processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const filename = path.basename(imagePath, path.extname(imagePath)) + '_processed.png';
  const processedPath = path.join(processedDir, filename);

  try {
    // Enhanced preprocessing pipeline for better OCR
    await sharp(imagePath)
      .resize(1600, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      // Remove noise and enhance contrast
      .median(3) // Remove noise
      .normalize() // Normalize histogram
      .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
      .grayscale()
      .sharpen({ sigma: 1, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 }) // Enhanced sharpening
      .threshold(128) // Convert to pure black and white
      .png()
      .toFile(processedPath);

    console.log(`Image preprocessed successfully: ${processedPath}`);
    return processedPath;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    // Fallback to simpler processing if enhanced fails
    await sharp(imagePath)
      .resize(1200, null, { withoutEnlargement: true, fit: 'inside' })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toFile(processedPath);
    
    return processedPath;
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
    
    const processedDir = path.join(process.cwd(), 'uploads', 'processed');
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

    // Get the number of pages in the PDF
    const maxPages = pdfData.numpages || 1;
    console.log(`Processing ${maxPages} pages from PDF`);

    let combinedText = '';
    let primaryImagePath = '';
    
    // Process each page
    for (let pageNum = 1; pageNum <= Math.min(maxPages, 5); pageNum++) { // Limit to 5 pages max
      console.log(`Processing page ${pageNum}/${maxPages}`);
      
      try {
        const results = await convert(pageNum);
        
        if (!results || !results.path) {
          console.warn(`Failed to convert page ${pageNum}, skipping...`);
          continue;
        }

        // Use the first page as the primary image
        if (pageNum === 1) {
          primaryImagePath = results.path;
        }

        // Run OCR on the converted image
        const ocrResult = await Tesseract.recognize(results.path, 'eng', {
          logger: m => console.log(`Page ${pageNum}: ${m.status}`)
        });

        if (ocrResult.data.text.trim().length > 0) {
          combinedText += `--- Page ${pageNum} ---\n${ocrResult.data.text}\n\n`;
        }
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }

    if (!combinedText.trim()) {
      throw new Error('No text could be extracted from any page of the PDF');
    }

    return {
      text: combinedText,
      imagePath: primaryImagePath || pdfPath
    };

  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

function extractReceiptData(ocrText: string): any {
  const lines = ocrText.split('\n').filter(line => line.trim().length > 0);
  
  const extractedData: any = {
    confidence: 0.7,
    items: []
  };

  // More comprehensive price patterns
  const moneyRegex = /\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g; // $X,XXX.XX format
  const totalRegex = /(?:total|amount\s+due|subtotal|balance\s+due|grand\s+total)[\s:]*\$?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i;
  const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/](?:\d{2}|\d{4}))/g;
  
  let allPrices = [];
  let dates = [];
  let explicitTotal = null;
  
  // Enhanced vendor extraction with fuzzy matching
  let vendor = null;
  const vendorResult = extractVendorWithFuzzyMatching(lines);
  vendor = vendorResult.vendor;
  
  console.log(`Vendor extraction result: ${vendor} (confidence: ${vendorResult.confidence})`);
  if (vendorResult.confidence < 0.6) {
    console.warn('Low confidence vendor detection:', vendorResult);
  }
  
  // Process each line for prices and totals
  for (const line of lines) {
    const cleanLine = line.trim().toLowerCase();
    
    // Skip obvious non-price lines
    if (cleanLine.match(/^(thank you|visit|www|http|store #|receipt #|transaction|card #|auth #|ref #|shipping|contact|email|phone)/)) {
      continue;
    }
    
    // Look for explicit total amounts (highest priority)
    const totalMatch = line.match(totalRegex);
    if (totalMatch) {
      const amountStr = totalMatch[1].replace(/,/g, ''); // Remove commas
      const foundTotal = parseFloat(amountStr);
      if (foundTotal > 0 && foundTotal < 10000) { // Reasonable total range
        explicitTotal = foundTotal;
        console.log(`Found explicit total: $${explicitTotal} in line: "${line.trim()}"`);
      }
    }
    
    // Extract all monetary amounts from the line
    const moneyMatches = [...line.matchAll(moneyRegex)];
    for (const match of moneyMatches) {
      const amountStr = match[1].replace(/,/g, ''); // Remove commas: "1,190.25" -> "1190.25"
      const price = parseFloat(amountStr);
      
      // Accept reasonable prices
      if (price > 0 && price < 10000) {
        allPrices.push({ 
          price, 
          line: line.trim(),
          // Mark if this appears to be a total line
          isLikelyTotal: cleanLine.includes('total') || cleanLine.includes('amount due') || cleanLine.includes('balance')
        });
      }
    }
    
    // Extract dates
    const dateMatches = line.match(dateRegex);
    if (dateMatches) {
      dates.push(...dateMatches);
    }
  }

  // Smart total amount selection
  if (explicitTotal) {
    extractedData.amount = explicitTotal;
    console.log(`Using explicit total: $${explicitTotal}`);
  } else if (allPrices.length > 0) {
    // Sort prices by amount (largest first)
    const sortedPrices = allPrices.sort((a, b) => b.price - a.price);
    
    // Prefer prices that appear to be totals
    const likelyTotalPrices = sortedPrices.filter(p => p.isLikelyTotal);
    if (likelyTotalPrices.length > 0) {
      extractedData.amount = likelyTotalPrices[0].price;
      console.log(`Using likely total: $${extractedData.amount} from line: "${likelyTotalPrices[0].line}"`);
    } else {
      // If multiple similar large amounts, take the largest (likely the total)
      // For receipts with subtotal and total, the total is usually larger
      extractedData.amount = sortedPrices[0].price;
      console.log(`Using largest amount as total: $${extractedData.amount} from line: "${sortedPrices[0].line}"`);
    }
  } else {
    console.log('No valid amount found in receipt');
  }

  // Set date (prefer the first valid date found)
  if (dates.length > 0) {
    extractedData.date = dates[0];
  }

  // Set vendor
  if (vendor) {
    extractedData.vendor = vendor;
  }

  // Extract line items - simplified and more conservative approach
  for (const line of lines) {
    // Skip lines that are clearly not items
    if (line.match(/(subtotal|total|amount due|tax|payment|card|auth|approved|thank|visit|www)/i)) {
      continue;
    }
    
    // Look for simple item patterns: "Item Name X.XX" where X.XX is a price with cents
    const itemMatch = line.match(/^\s*([A-Za-z][A-Za-z\s&']{3,30}?)\s+(\d{1,3}\.\d{2})\s*$/);
    
    if (itemMatch) {
      const description = itemMatch[1].trim().replace(/[^\w\s&']/g, '').trim();
      const price = parseFloat(itemMatch[2]);
      
      // Validate item - be very conservative
      if (description.length >= 3 && description.length <= 40 && 
          price > 0.01 && price <= 100 && // Conservative price range for individual items
          /[A-Za-z]{3,}/.test(description) && // Must contain real words
          !description.match(/^(store|receipt|thank|visit|total|subtotal)/i)) {
        
        // Check for duplicates
        const isDuplicate = extractedData.items.some((existing: any) => 
          existing.description.toLowerCase() === description.toLowerCase() && 
          Math.abs(existing.price - price) < 0.01
        );
        
        if (!isDuplicate) {
          extractedData.items.push({
            description,
            price,
            quantity: 1
          });
        }
      }
    }
  }

  // Limit items to prevent noise
  extractedData.items = extractedData.items.slice(0, 8);

  return extractedData;
}

function categorizePurchase(vendor: string, description: string, amount: number): string {
  const vendorName = vendor || 'Unknown';
  const vendorLower = vendorName.toLowerCase();
  
  // Map common vendor variations to standard names
  const vendorMappings: { [key: string]: string } = {
    'walmart': 'Walmart',
    'target': 'Target', 
    'kroger': 'Kroger',
    'aldi': 'Aldi',
    'costco': 'Costco',
    'amazon': 'Amazon',
    'instacart': 'Instacart',
    'doordash': 'DoorDash',
    'door dash': 'DoorDash',
    'uber eats': 'Uber Eats',
    'uber': 'Uber Eats',
    'starbucks': 'Starbucks',
    'shell': 'Shell',
    'exxon': 'Exxon',
    'bp': 'BP',
    'cvs': 'CVS',
    'walgreens': 'Walgreens',
    'mcdonalds': 'McDonalds',
    'mcdonald': 'McDonalds',
    'pizza hut': 'Pizza Hut',
    'dominos': 'Dominos',
    'taco bell': 'Taco Bell',
    'subway': 'Subway',
    'chipotle': 'Chipotle',
    'whole foods': 'Whole Foods',
    'home depot': 'Home Depot',
    'lowes': 'Lowes',
    'best buy': 'Best Buy',
    'apple': 'Apple',
    'microsoft': 'Microsoft',
    'google': 'Google',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'at&t': 'AT&T',
    'verizon': 'Verizon',
    't-mobile': 'T-Mobile'
  };
  
  // Check for exact vendor mapping first
  let mappedVendor = vendorMappings[vendorLower];
  
  if (!mappedVendor) {
    // Check if vendor name contains any of the mapped vendors
    for (const [key, value] of Object.entries(vendorMappings)) {
      if (vendorLower.includes(key)) {
        mappedVendor = value;
        break;
      }
    }
  }
  
  // If no mapping found, use the original vendor name (cleaned up)
  if (!mappedVendor) {
    mappedVendor = vendorName.charAt(0).toUpperCase() + vendorName.slice(1).toLowerCase();
  }
  
  // Create or get vendor category
  return getOrCreateCategory(mappedVendor);
}

async function createExpenseFromExtractedData(extractedData: any, receiptId: string): Promise<void> {
  try {
    // Only create expense if we have a valid amount
    if (!extractedData.amount || extractedData.amount <= 0) {
      console.log(`Skipping expense creation for receipt ${receiptId}: no valid amount found`);
      return;
    }

    const expenseId = uuidv4();
    
    // Smart categorization
    const description = extractedData.vendor 
      ? `Purchase at ${extractedData.vendor}` 
      : 'Receipt purchase';
    
    const smartCategory = categorizePurchase(
      extractedData.vendor || '', 
      description, 
      extractedData.amount
    );
    
    // Create expense from total amount
    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, amount, description, category, date, vendor, tags, receipt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const expenseDate = extractedData.date 
      ? formatDate(extractedData.date)
      : new Date().toISOString().split('T')[0];
    
    const tags = JSON.stringify(['receipt-import', 'auto-created']);

    insertExpense.run(
      expenseId,
      extractedData.amount,
      description,
      smartCategory,
      expenseDate,
      extractedData.vendor || 'Unknown',
      tags,
      receiptId
    );

    console.log(`Auto-created expense ${expenseId} from receipt ${receiptId}: $${extractedData.amount}`);
    
  } catch (error) {
    console.error(`Error creating expense from receipt ${receiptId}:`, error);
  }
}

async function performEnhancedOCR(imagePath: string, retryMode: boolean = false): Promise<{ text: string; confidence: number }> {
  try {
    const ocrConfig = {
      logger: (m: any) => console.log(`OCR: ${m.status} - ${m.progress}%`),
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,/:- ',
      tessedit_pageseg_mode: retryMode ? Tesseract.PSM.SPARSE_TEXT : Tesseract.PSM.SINGLE_BLOCK
    };

    const result = await Tesseract.recognize(imagePath, 'eng', ocrConfig);
    
    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    // Fallback to basic OCR
    const result = await Tesseract.recognize(imagePath, 'eng');
    return {
      text: result.data.text,
      confidence: result.data.confidence || 0
    };
  }
}

function validateOCRQuality(text: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;
  
  // Check for text length
  if (text.length < 20) {
    issues.push('Text too short');
    score -= 3;
  }
  
  // Check for excessive special characters (indicates poor OCR)
  const specialCharRatio = (text.match(/[^a-zA-Z0-9\s$.,:/\-]/g) || []).length / text.length;
  if (specialCharRatio > 0.3) {
    issues.push('Too many special characters');
    score -= 4;
  }
  
  // Check for reasonable word ratio
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const validWords = words.filter(w => /^[a-zA-Z0-9$.,:/\-]+$/.test(w));
  const wordRatio = validWords.length / words.length;
  if (wordRatio < 0.6) {
    issues.push('Low valid word ratio');
    score -= 2;
  }
  
  // Check for reasonable line structure
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 3) {
    issues.push('Too few lines detected');
    score -= 1;
  }
  
  return { score: Math.max(0, score), issues };
}

function extractVendorWithFuzzyMatching(lines: string[]): { vendor: string | null; confidence: number } {
  // Comprehensive list of known vendors with variations
  const knownVendors = [
    { name: 'Walmart', variations: ['walmart', 'wal-mart', 'wal mart', 'walmart supercenter', 'walmart.com'] },
    { name: 'Target', variations: ['target', 'target.com', 'target corporation'] },
    { name: 'Amazon', variations: ['amazon', 'amazon.com', 'amazon prime', 'amzn', 'amazon marketplace'] },
    { name: 'Kroger', variations: ['kroger', 'kroger co', 'kroger family', 'kroger.com'] },
    { name: 'Aldi', variations: ['aldi', 'aldi inc', 'aldi foods', 'aldi store'] },
    { name: 'Costco', variations: ['costco', 'costco wholesale', 'costco.com'] },
    { name: 'Instacart', variations: ['instacart', 'instacart.com'] },
    { name: 'DoorDash', variations: ['doordash', 'door dash', 'doordash.com'] },
    { name: 'Uber Eats', variations: ['uber eats', 'uber', 'ubereats'] },
    { name: 'Starbucks', variations: ['starbucks', 'starbucks coffee', 'starbucks corporation'] },
    { name: 'Home Depot', variations: ['home depot', 'the home depot', 'homedepot.com'] },
    { name: 'Lowes', variations: ['lowes', 'lowes', 'lowes home improvement'] },
    { name: 'Best Buy', variations: ['best buy', 'bestbuy.com'] },
    { name: 'CVS', variations: ['cvs', 'cvs pharmacy', 'cvs health'] },
    { name: 'Walgreens', variations: ['walgreens', 'walgreens pharmacy'] },
    { name: 'Shell', variations: ['shell', 'shell oil', 'shell station'] },
    { name: 'Exxon', variations: ['exxon', 'exxonmobil', 'exxon mobil'] },
    { name: 'McDonalds', variations: ['mcdonalds', 'mcdonalds', 'mc donalds'] },
    { name: 'Subway', variations: ['subway', 'subway sandwiches'] },
    { name: 'Chipotle', variations: ['chipotle', 'chipotle mexican grill'] },
    { name: 'Whole Foods', variations: ['whole foods', 'whole foods market', 'wholefoods'] }
  ];
  
  // Create flat list for Fuse.js
  const vendorList = knownVendors.flatMap(vendor => 
    vendor.variations.map(variation => ({ name: vendor.name, variation }))
  );
  
  const fuse = new Fuse(vendorList, {
    keys: ['variation'],
    threshold: 0.4, // Allow some fuzzy matching
    includeScore: true
  });
  
  let bestMatch = null;
  let highestConfidence = 0;
  
  // Check first 20 lines for vendor information
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip obviously irrelevant lines
    if (isIrrelevantLine(line)) {
      continue;
    }
    
    // Clean the line for matching
    const cleanLine = cleanLineForVendorDetection(line);
    if (cleanLine.length < 3) continue;
    
    // Try fuzzy matching
    const results = fuse.search(cleanLine);
    
    if (results.length > 0 && results[0].score !== undefined) {
      const confidence = 1 - results[0].score; // Convert distance to confidence
      
      if (confidence > highestConfidence && confidence > 0.5) {
        bestMatch = results[0].item.name;
        highestConfidence = confidence;
      }
    }
    
    // Also try word-by-word matching within the line
    const words = cleanLine.split(/\s+/);
    for (const word of words) {
      if (word.length > 2) {
        const wordResults = fuse.search(word);
        if (wordResults.length > 0 && wordResults[0].score !== undefined) {
          const confidence = 1 - wordResults[0].score;
          if (confidence > highestConfidence && confidence > 0.6) {
            bestMatch = wordResults[0].item.name;
            highestConfidence = confidence;
          }
        }
      }
    }
  }
  
  return {
    vendor: bestMatch,
    confidence: highestConfidence
  };
}

function isIrrelevantLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  
  // Skip lines that are clearly not vendor information
  const irrelevantPatterns = [
    /^(show order|order #|thank you|shipping|contact|total|subtotal|tax|order details)/,
    /^(receipt|transaction|card|auth|approved|declined)/,
    /^(date|time|address|phone|email|website)/,
    /^(ship to|shipped to|redeem|offer|coupon)/,
    /^\$\d+/, // Price lines
    /^\d+\s*$/, // Pure numbers
    /^[^a-zA-Z]*$/, // No letters
    /^.{0,2}$/ // Too short
  ];
  
  return irrelevantPatterns.some(pattern => pattern.test(lowerLine));
}

function cleanLineForVendorDetection(line: string): string {
  return line
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
}

function formatDate(dateString: string): string {
  try {
    // Handle various date formats from OCR
    let normalizedDate = dateString.replace(/[-\/]/g, '/');
    
    // Try to parse the date
    const date = new Date(normalizedDate);
    
    // If invalid date, return today's date
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    // Return in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch (error) {
    // If any error, return today's date
    return new Date().toISOString().split('T')[0];
  }
}