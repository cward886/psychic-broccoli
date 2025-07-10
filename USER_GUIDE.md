# Expense Tracker User Guide

A comprehensive guide to using your personal expense tracking application with receipt scanning capabilities.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Expenses](#managing-expenses)
4. [Receipt Scanner](#receipt-scanner)
5. [Categories and Organization](#categories-and-organization)
6. [Tips and Best Practices](#tips-and-best-practices)
7. [Data Management](#data-management)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Launch

1. **Start the Application**
   ```bash
   npm run dev  # Start development servers
   npm start    # Launch the Electron app
   ```

2. **Initial Setup**
   - The application will automatically create a SQLite database with default categories
   - Default categories include: Groceries, Utilities, Rent, Transportation, Entertainment, Healthcare, and Other
   - The interface loads with an empty dashboard ready for your first expenses

### Interface Overview

The application has four main sections accessible via the top navigation:

- **Dashboard** - Overview of your spending patterns
- **Expenses** - Detailed expense management and viewing
- **Receipts** - Receipt scanning and OCR processing
- **Add Expense** - Manual expense entry form

---

## Dashboard Overview

### What You'll See

The dashboard provides a high-level view of your financial activity:

#### Statistics Cards
- **Total Expenses** - Count of all recorded expenses
- **Total Amount** - Sum of all expenses to date
- **This Month** - Current month's spending total

#### Monthly Spending by Category
- Visual breakdown of spending by category for the current month
- Color-coded categories with spending amounts
- Helps identify your biggest expense categories

#### Recent Expenses
- List of your 5 most recent expenses
- Quick overview of recent spending activity

### Using the Dashboard

1. **Monitor Monthly Spending**
   - Check your monthly total against your budget
   - Identify which categories are consuming the most money

2. **Track Trends**
   - Compare monthly totals over time
   - Notice patterns in your spending habits

3. **Quick Expense Review**
   - Glance at recent expenses to ensure accuracy
   - Catch any missed or duplicate entries

---

## Managing Expenses

### Adding New Expenses

#### Manual Entry

1. **Navigate to "Add Expense" Tab**
2. **Fill Required Fields**
   - **Amount**: Enter the expense amount (required)
   - **Date**: Select the expense date (defaults to today)
   - **Description**: Brief description of the expense (required)
   - **Category**: Choose from available categories (required)

3. **Optional Fields**
   - **Vendor**: Store or service provider name
   - **Tags**: Comma-separated tags for better organization

4. **Submit**: Click "Add Expense" to save

#### Example Entry
```
Amount: $45.67
Date: 2024-01-15
Description: Weekly groceries
Category: Groceries
Vendor: Safeway
Tags: food, weekly, essentials
```

### Viewing and Managing Expenses

#### Expense List Features

1. **Search Functionality**
   - Search by description or vendor name
   - Real-time filtering as you type

2. **Category Filtering**
   - Filter by specific categories
   - "All Categories" shows everything

3. **Sorting Options**
   - Sort by Date, Amount, or Description
   - Toggle ascending/descending order with the arrow button

4. **Expense Details**
   - Each expense shows: description, date, vendor, amount, and category
   - Color-coded category tags for quick identification

#### Expense Summary
- **Total Count**: Number of expenses matching your filters
- **Total Amount**: Sum of filtered expenses
- Useful for analyzing spending in specific categories or time periods

---

## Receipt Scanner

### How Receipt Scanning Works

The receipt scanner uses OCR (Optical Character Recognition) to automatically extract information from receipt images:

1. **Image Processing**: Receipt images are optimized for better OCR accuracy
2. **Text Extraction**: Tesseract.js extracts text from the processed image
3. **Data Parsing**: Smart algorithms identify amounts, dates, vendors, and items
4. **Review Process**: You can review and edit extracted data before creating expenses

### Uploading Receipts

#### Method 1: Drag and Drop
1. Navigate to the "Receipts" tab
2. Drag receipt images directly onto the upload area
3. Multiple images can be uploaded simultaneously

#### Method 2: File Selection
1. Click "Select Images" button
2. Choose receipt images from your file system
3. Supports PNG, JPG, JPEG, GIF, and BMP formats

### Receipt Processing Workflow

#### 1. Upload Status
- **Pending**: Receipt uploaded, waiting for processing
- **Processing**: OCR is currently analyzing the image
- **Completed**: Processing finished, data extracted
- **Failed**: Processing encountered an error

#### 2. Reviewing Extracted Data

When processing completes successfully, you'll see:

- **Amount**: Detected total amount (usually the largest number)
- **Vendor**: Identified store or business name
- **Date**: Extracted transaction date
- **Items**: List of individual items with prices

#### 3. Creating Expenses from Receipts

1. Review the extracted information for accuracy
2. Click "Create Expense from Receipt" (coming soon)
3. The system will pre-fill the expense form with extracted data
4. Make any necessary corrections
5. Save the expense

### Best Practices for Receipt Scanning

#### Photo Quality Tips
- **Good Lighting**: Ensure the receipt is well-lit
- **Flat Surface**: Place receipt on a flat, contrasting background
- **Full Receipt**: Capture the entire receipt including totals
- **Clear Image**: Avoid blurry or tilted photos
- **High Contrast**: Dark text on light background works best

#### What Gets Extracted
- **Total Amount**: The final amount paid
- **Vendor Name**: Store or business name
- **Transaction Date**: When the purchase was made
- **Individual Items**: Line items with descriptions and prices
- **Confidence Level**: How confident the OCR is about the data

---

## Categories and Organization

### Default Categories

Your application comes with these pre-configured categories:

| Category | Icon | Description |
|----------|------|-------------|
| 🛒 Groceries | Green | Food and household items |
| 💡 Utilities | Yellow | Electricity, gas, water, internet |
| 🏠 Rent | Red | Housing costs |
| 🚗 Transportation | Blue | Gas, public transit, parking |
| 🎬 Entertainment | Purple | Movies, dining, leisure |
| ⚕️ Healthcare | Pink | Medical, pharmacy, insurance |
| 📝 Other | Gray | Miscellaneous expenses |

### Using Categories Effectively

#### Best Practices
1. **Be Consistent**: Always use the same category for similar expenses
2. **Use "Other" Sparingly**: Try to fit expenses into existing categories
3. **Tag for Subcategories**: Use tags to create subcategories within main categories

#### Example Categorization
```
Groceries:
- Weekly shopping: Groceries + tags: "weekly, food"
- Household supplies: Groceries + tags: "supplies, cleaning"

Transportation:
- Gas: Transportation + tags: "gas, vehicle"
- Public transit: Transportation + tags: "transit, metro"
```

### Tags for Enhanced Organization

Tags provide additional organization beyond categories:

#### Effective Tag Strategies
- **Frequency**: "weekly", "monthly", "annual"
- **Necessity**: "essential", "luxury", "emergency"
- **Person**: "john", "mary", "shared"
- **Project**: "apartment", "vacation", "work"

#### Tag Examples
```
Rent payment: Category: Rent, Tags: "monthly, essential"
Emergency repair: Category: Other, Tags: "emergency, apartment"
Date night: Category: Entertainment, Tags: "monthly, couple"
```

---

## Tips and Best Practices

### Expense Tracking Habits

#### Daily Habits
1. **Immediate Entry**: Add expenses as soon as possible
2. **Receipt Collection**: Keep receipts for scanning later
3. **Quick Review**: Check recent expenses daily for accuracy

#### Weekly Habits
1. **Receipt Scanning**: Process collected receipts weekly
2. **Category Review**: Ensure expenses are properly categorized
3. **Budget Check**: Review spending against monthly targets

#### Monthly Habits
1. **Full Review**: Analyze monthly spending patterns
2. **Category Analysis**: Identify areas for potential savings
3. **Data Backup**: Export or backup your expense data

### Maximizing Receipt Scanner Accuracy

#### Photo Tips
- Use good lighting, preferably natural light
- Keep the receipt flat and straight
- Ensure the entire receipt is visible
- Use a contrasting background (white paper works well)

#### Common Issues and Solutions
- **Blurry Text**: Take multiple photos and choose the clearest
- **Faded Receipts**: Increase contrast or use a scanner app first
- **Crumpled Receipts**: Flatten carefully before photographing
- **Long Receipts**: May need to photograph in sections

### Data Organization

#### Consistent Descriptions
- Use clear, descriptive expense names
- Include key details: "Weekly groceries - Safeway"
- Avoid abbreviations that might confuse you later

#### Smart Tag Usage
- Keep tags short and consistent
- Use lowercase for consistency
- Create a personal tag system and stick to it

---

## Data Management

### Data Storage Location

Your expense data is stored locally in these locations:

```
expense-tracker/
├── database/
│   └── expenses.db          # SQLite database file
└── uploads/
    ├── [receipt-images]     # Original receipt images
    └── processed/
        └── [processed-images] # OCR-processed images
```

### Backup Strategy

#### Manual Backup
1. **Copy Database**: Back up `database/expenses.db`
2. **Copy Images**: Back up entire `uploads/` folder
3. **Store Safely**: Keep backups in multiple locations

#### Recommended Backup Schedule
- **Daily**: For active users with frequent expenses
- **Weekly**: For moderate users
- **Monthly**: For light users

### Data Export Options

#### Future Features (Coming Soon)
- CSV export for spreadsheet analysis
- PDF reports for record keeping
- JSON export for data migration

#### Current Manual Export
- Database can be opened with any SQLite viewer
- Images are stored as regular files in the uploads folder

### Data Privacy and Security

#### Local Storage Benefits
- **Complete Control**: Your data never leaves your device
- **No Cloud Dependency**: Works offline, no internet required
- **Privacy**: No third-party access to your financial data

#### Security Considerations
- **File Permissions**: Ensure database files have appropriate permissions
- **Backup Security**: Store backups in secure locations
- **Device Security**: Use disk encryption for sensitive data

---

## Troubleshooting

### Common Issues and Solutions

#### Application Won't Start
**Problem**: App fails to launch
**Solutions**:
1. Ensure all dependencies are installed: `npm install`
2. Build the application: `npm run build`
3. Check for port conflicts (ports 3000 and 3001)
4. Restart your computer and try again

#### Receipt Scanner Issues

**Problem**: OCR processing fails
**Solutions**:
1. Check image quality and lighting
2. Ensure receipt is clearly visible and flat
3. Try with a different receipt image
4. Restart the application

**Problem**: Poor OCR accuracy
**Solutions**:
1. Improve photo quality (lighting, focus, contrast)
2. Use a scanner app to create cleaner images
3. Try photographing receipt sections separately
4. Manual entry for problematic receipts

#### Database Issues

**Problem**: Database errors or corruption
**Solutions**:
1. Close the application completely
2. Backup existing database if possible
3. Delete `database/expenses.db` to reset
4. Restart the application (will recreate database)

#### Performance Issues

**Problem**: App running slowly
**Solutions**:
1. Clear browser cache if using development mode
2. Restart the application
3. Check available disk space
4. Reduce number of stored receipt images

### Getting Help

#### Log Files
- Check terminal/console output for error messages
- Look for specific error codes or messages
- Note when the problem occurs (startup, specific action, etc.)

#### Reporting Issues
When reporting problems, include:
1. What you were trying to do
2. What happened instead
3. Any error messages
4. Your operating system and Node.js version

---

## Advanced Usage

### Workflow Optimization

#### Efficient Expense Entry
1. **Batch Processing**: Handle multiple receipts at once
2. **Consistent Timing**: Set regular times for expense entry
3. **Template Descriptions**: Use consistent formats for similar expenses

#### Analysis Techniques
1. **Monthly Comparisons**: Compare spending across months
2. **Category Trends**: Track changes in category spending
3. **Vendor Analysis**: Identify your most frequent vendors

### Customization Options

#### Future Enhancements
- Custom categories and colors
- Budget limits and alerts
- Spending reports and charts
- Data export formats
- Mobile companion app

---

## Conclusion

This expense tracker is designed to give you complete control over your financial data while providing powerful features for tracking and analyzing your spending. The receipt scanner automates data entry, while the categorization system helps you understand your spending patterns.

Remember:
- **Consistency is key** - Regular use provides the best insights
- **Review regularly** - Monthly analysis helps identify trends
- **Backup your data** - Protect your financial records
- **Use tags effectively** - Enhance organization beyond categories

For additional support or feature requests, refer to the main README.md file or the application's documentation.

---

*Last updated: January 2024*