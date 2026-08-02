-- Trades live vs backtesting
ALTER TABLE trades ADD COLUMN mode TEXT DEFAULT 'live';
