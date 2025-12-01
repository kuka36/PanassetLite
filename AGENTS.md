# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

PanassetLite is a local-first, AI-driven personal finance management application built with React 19, TypeScript, and Vite. It follows event-sourcing principles where "Transaction is Truth" - all asset state is derived from transaction history.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## Architecture

### Core Principles
- **Event Sourcing**: All financial state is computed from transaction history via `PortfolioEngine`
- **Local-First**: Data stored in browser's LocalStorage via `StorageService`
- **Privacy-Focused**: No registration, data never leaves browser without explicit API calls
- **Progressive Enhancement**: Works without API keys, enhanced with them

### Key Directories
- `components/` - React components organized by feature (ui/, analytics/, chat/)
- `services/` - Business logic (PortfolioEngine, StorageService, market data, AI agents)
- `context/` - React Context providers (PortfolioContext for global state)
- `types/` - TypeScript definitions (domain.ts for core data models)
- `utils/` - Utility functions and i18n translations

### Data Flow
1. **Transactions** are the source of truth (`types/domain.ts`)
2. **PortfolioEngine** computes asset state from transactions
3. **StorageService** persists data to LocalStorage with caching
4. **MarketDataService** fetches real-time prices from external APIs
5. **AI Agents** (Gemini/DeepSeek) provide natural language interface

### State Management
- **PortfolioContext**: Global state using React Context + useReducer
- **Event Sourcing**: State derived from transaction history, not mutable objects
- **LocalStorage**: Persistent storage with versioning and migration support

## API Integration

### Required Environment Variables (optional)
Configure in Settings UI or via `.env`:
- `GEMINI_API_KEY` - Google Gemini for AI advisor
- `API_KEY` - Alpha Vantage for stock/ETF prices

### External Services
- **Alpha Vantage**: Stock/ETF real-time prices
- **CoinGecko**: Cryptocurrency prices
- **Google Gemini**: Primary AI agent (fallback to DeepSeek)

## Build & CI

### Commands
- `npm run build` runs `tsc && vite build` (typecheck before build)
- `npm run deploy` runs build then deploys to GitHub Pages via gh-pages

### CI Workflow (`.github/workflows/ci.yml`)
- Only runs `npm run build` - no separate typecheck or test step
- No test suite exists in this project

### Vite Config (`vite.config.ts`)
- **Base path**: `/PanassetLite/` for GitHub Pages deployment
- **Port**: 3000 with host `0.0.0.0`
- **Code splitting**: Vendor, recharts, and markdown chunks
- **Minification**: Terser with console removal in production
- **Aliases**: `@/` maps to project root

### TypeScript Config
- **Target**: ES2022
- **Module**: ESNext
- **JSX**: react-jsx
- **noEmit**: true (typecheck only via `tsc` in build)

## Development Guidelines

### Event Sourcing Pattern
- All state changes must go through transactions
- Use `PortfolioEngine.calculateAssets()` to compute asset state
- Never modify asset quantities directly - always create transactions
- Transaction types: BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL, BORROW, REPAY, BALANCE_ADJUSTMENT

### Data Models
- **AssetType**: STOCK, CRYPTO, FUND, CASH, REAL_ESTATE, LIABILITY, OTHER
- **Currency**: USD, CNY, HKD (auto-converted via exchange rates)
- **Asset**: Computed fields (quantity, avgCost, currentValue, PnL)
- **Transaction**: Source of truth with quantity changes

### AI Integration
- Natural language interface for all operations
- Dual-engine fallback (Gemini primary, DeepSeek secondary)
- Context-aware financial advice based on portfolio data
- Chat interface with slide-in panel

### Performance Considerations
- Market data cached to avoid rate limits
- LocalStorage operations batched and debounced
- Chart rendering optimized with Recharts virtualization
- Code splitting for vendor libraries

## Deployment

- Automatic deployment via `npm run deploy`
- Base path: `/PanassetLite/` for GitHub Pages
- No backend - purely static hosting

## Key Files for Reference

- `types/domain.ts` - Core data models and types
- `services/PortfolioEngine.ts` - Event-sourced calculations
- `context/PortfolioContext.tsx` - Global state management
- `services/StorageService.ts` - LocalStorage persistence
- `components/chat/ChatPanel.tsx` - AI interface
- `vite.config.ts` - Build configuration