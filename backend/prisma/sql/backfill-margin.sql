-- Phase 2 adds goods.margin. Fills it for goods created before the column existed.
UPDATE public.goods
SET margin = CASE WHEN expected_revenue = 0 THEN NULL ELSE ROUND(profit / expected_revenue * 100, 2) END
WHERE margin IS NULL;
