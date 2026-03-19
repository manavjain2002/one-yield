

# HederaFi — Institutional DeFi Lending Platform

## Overview
A dark-themed, institutional-grade RWA Lending & Borrowing platform on Hedera with three user roles: Borrower, Lender, and Pool Manager. Wallet-based auth only, data-rich dashboards, and on-chain transparency throughout.

## Design System
- **Theme**: Dark-first with blue/indigo gradient accents, green for success, orange/red for risk
- **Typography**: Inter font family, clean and modern
- **Components**: Card-based layouts with rounded-2xl, soft shadows, glassmorphism touches
- **Colors**: Deep navy/slate backgrounds, indigo/blue primary, with vibrant data visualization colors

## Pages & Features

### 1. Wallet Connect Landing Page
- Fullscreen dark landing with platform branding and tagline
- "Connect Wallet" CTA button with gradient styling
- Wallet selection modal (HashPack, Blade icons)
- After connection → Role selection screen (Borrower / Lender / Pool Manager cards)
- Mock wallet connection state stored in React context

### 2. Shared Layout & Navigation
- Top navbar: Logo, role-based nav links (Earn, Portfolio, Admin), wallet address pill, network indicator (Hedera Mainnet/Testnet badge)
- Mobile: bottom navigation bar with stacked card layouts
- Smart contract risk disclaimer footer
- Toast notification system for transaction states (Pending → Confirmed → Failed)
- Skeleton loaders on all data-heavy pages
- Low HBAR balance warning banner

### 3. Borrower Flow

**Dashboard** — Metric cards (Total Borrowed, Total Repaid, Pending Amount, Active Pools) + recent activity feed

**Pool List** — Grid of pool cards showing name, borrowed amount, status badge, and a jar/liquid-fill progress indicator showing fill percentage with animation

**Create Pool Modal** — First-time user flow: Pool Name, Symbol, Value to Borrow, multi-select token picker → Create Pool CTA

**Pool Detail Page**:
- Overview section: Total Requested, Total Received, animated fill progress bar, borrow date, HashScan tx links
- Child Pool Allocation: Pie chart + table of wallet addresses with allocation %, validation that allocations sum to 100%
- Repayment section: Amount input + Repay Loan button
- History tabs: Borrow history, Repayment history, Funds received — each as sortable tables with timestamps and tx hash links

### 4. Lender Flow

**Dashboard** — Metric cards (Total Deposited, Current Value, Yield Earned, Pending Returns)

**Available Pools** — Grid of pool cards: Pool Name, APY%, Total Balance, Fund Manager Balance, Risk tag (Low/Medium/High), fill progress bar, Deposit CTA

**Deposit Modal** — Amount input, expected yield preview, LP tokens to receive, Approve + Deposit buttons

**Portfolio Page** — Table view: Pool, Deposited, Current Value, Yield, Pending, Withdraw action button

**Withdraw Flow**:
- Early withdrawal warning popup ("You will miss future returns" with Continue/Cancel)
- Instant vs Queue withdraw states
- Queue view: position number, estimated wait time with countdown

### 5. Pool Manager Flow

**Dashboard** — Metric cards (AUM, Pool Balance, Fund Manager Balance, Pending Repayments) + AUM growth line chart

**Pool Management Page** per pool:
- Overview: Total Pool Funds, Funds with Fund Manager, Funds in Pool (with donut chart)
- Fund Transfer controls: Pool ↔ Fund Manager with amount input and directional CTA buttons
- Pool Controls: Activate/Pause toggle switch
- Analytics: AUM line chart, fund flow history chart

**History Tables** — Tabs for: Funds transferred, Borrower received, Repayments, Lender payouts

### 6. Shared Chart Components
- APY Line Chart (Recharts)
- Liquid/jar-fill pool progress animation (custom CSS + SVG)
- Allocation Pie Chart (Recharts)
- AUM Growth Area Chart (Recharts)
- Progress bars with gradient fills

### 7. Data & State
- All data is mock/demo data stored in local state and constants
- Wallet connection simulated via React Context
- Role-based routing: different dashboard and nav per role
- No backend — purely frontend prototype

### 8. Responsiveness
- Desktop-first with max-width containers
- Tablet: 2-column grid adjustments
- Mobile: single column stacked cards, bottom navigation bar

