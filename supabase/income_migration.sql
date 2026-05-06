-- Income entries: stores base salary config and individual paychecks per user
CREATE TABLE income_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salary', 'paycheck')),
  -- For 'salary': annual gross salary, effective_date = when this salary started
  -- For 'paycheck': actual net take-home for a single paycheck
  amount DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0, -- effective tax rate % (used for salary → net calculation)
  date TEXT NOT NULL,           -- YYYY-MM-DD: effective date (salary) or pay date (paycheck)
  label TEXT,                   -- optional label, e.g. "Q1 Bonus paycheck", "Regular biweekly"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own income entries"
  ON income_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own income entries"
  ON income_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own income entries"
  ON income_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own income entries"
  ON income_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_income_entries_user_date ON income_entries(user_id, date);
