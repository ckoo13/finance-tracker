-- Run this AFTER nw_fields_migration.sql
-- Replace YOUR_USER_ID with your actual user UUID from Supabase Auth > Users

INSERT INTO user_nw_fields (user_id, field_type, key, label, is_liquid, sort_order) VALUES
  ('YOUR_USER_ID', 'asset', '401k',              '401K',              false, 0),
  ('YOUR_USER_ID', 'asset', 'coinbase',           'Coinbase',          false, 1),
  ('YOUR_USER_ID', 'asset', 'sunstone_coinvest',  'Sunstone Co-Invest',false, 2),
  ('YOUR_USER_ID', 'asset', 'bofa_checking',      'BofA Checking',     true,  3),
  ('YOUR_USER_ID', 'asset', 'schwab',             'Charles Schwab',    true,  4),
  ('YOUR_USER_ID', 'asset', 'bofa_savings',       'BofA Savings',      true,  5),
  ('YOUR_USER_ID', 'asset', 'hsa_alphasights',    'HSA (AlphaSights)', false, 6),
  ('YOUR_USER_ID', 'asset', 'hsa_sunstone',       'HSA (Sunstone)',    false, 7),
  ('YOUR_USER_ID', 'liability', 'bilt_card',      'BILT Card',         false, 0),
  ('YOUR_USER_ID', 'liability', 'amex_delta',     'AMEX Delta',        false, 1);
