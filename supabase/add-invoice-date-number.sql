-- Add invoice_date and invoice_number columns to invoices table
-- These store the date and number extracted from the PDF by Claude,
-- as opposed to created_at which is the upload timestamp.

ALTER TABLE invoices ADD COLUMN invoice_date DATE;
ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(100);
