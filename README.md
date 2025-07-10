# Expense Tracker

A desktop expense tracking application with receipt scanning capabilities built with Electron, React, and Node.js.

## Features

- **Receipt Scanner**: Upload receipt images and automatically extract expense data using OCR
- **Expense Management**: Add, categorize, and track expenses with detailed information
- **Dashboard**: View spending summaries and category breakdowns
- **Local Database**: All data stored locally using SQLite
- **Self-Hosted**: Runs entirely on your hardware with no cloud dependencies

## Technology Stack

- **Frontend**: React with TypeScript
- **Backend**: Express.js with SQLite database
- **Desktop**: Electron
- **OCR**: Tesseract.js for receipt text extraction
- **Image Processing**: Sharp for image optimization

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start the development environment:
   ```bash
   npm run dev
   ```

2. This will start three processes:
   - Express server (port 3001)
   - React development server (port 3000)
   - Electron main process compilation

3. Start the Electron app:
   ```bash
   npm start
   ```

### Building for Production

1. Build all components:
   ```bash
   npm run build
   ```

2. Package the application:
   ```bash
   npm run package
   ```

## Project Structure

```
expense-tracker/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   │   ├── components/ # React components
│   │   └── styles.css  # Application styles
│   ├── server/         # Express API server
│   │   ├── database.ts # Database initialization
│   │   ├── index.ts    # Server entry point
│   │   └── receipt-processor.ts # OCR processing
│   └── shared/         # Shared TypeScript types
├── database/           # SQLite database files
├── uploads/            # Receipt image storage
│   └── processed/      # Processed receipt images
└── assets/            # Static assets
```

## Database Schema

The application uses SQLite with the following tables:

- **expenses**: Main expense records
- **receipts**: Receipt images and OCR data
- **categories**: Expense categories
- **budgets**: Budget limits by category

## Usage

### Adding Expenses

1. Click "Add Expense" tab
2. Fill in expense details (amount, description, category, date)
3. Optionally add vendor and tags
4. Click "Add Expense"

### Scanning Receipts

1. Click "Receipts" tab
2. Drag and drop receipt images or click "Select Images"
3. Wait for OCR processing to complete
4. Review extracted data and create expenses from receipts

### Viewing Dashboard

1. Click "Dashboard" tab
2. View spending summaries and category breakdowns
3. See recent expenses and monthly totals

## Security

- All data is stored locally on your machine
- No cloud services or external APIs required
- Receipt images are stored in the local `uploads/` directory
- Database is encrypted with SQLite's built-in encryption

## Backup and Export

- Database file: `database/expenses.db`
- Receipt images: `uploads/` directory
- Copy these directories to back up your data

## Troubleshooting

### Common Issues

1. **Port already in use**: Change ports in `src/server/index.ts` and `webpack.config.js`
2. **OCR not working**: Ensure receipt images are clear and well-lit
3. **Database errors**: Delete `database/expenses.db` to reset the database

### Development

- View logs in the Electron console (View → Toggle Developer Tools)
- Server logs appear in the terminal running `npm run dev`
- React development server runs on http://localhost:3000

## Contributing

This is a self-hosted application designed for personal use. Feel free to modify and extend it for your needs.

## License

MIT License - Feel free to use and modify as needed.