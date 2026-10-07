-- =============================================================================
-- PHASE 3: CUSTOMER STATUS + PRIORITY ENUM MIGRATION
-- Safe migration strategy for MySQL:
--   1. Add a temporary VARCHAR column
--   2. Copy mapped values into it
--   3. Drop old column
--   4. Add new column with new enum type
--   5. Copy values back
--   6. Drop temp column
-- =============================================================================

-- ===== STEP 1: Customer Status Migration =====

-- 1a. Add a temporary staging column
ALTER TABLE `customers`
  ADD COLUMN `overall_status_new` VARCHAR(50) NULL;

-- 1b. Map old enum values → new enum string values
UPDATE `customers` SET `overall_status_new` = 'LEAD_MOI'      WHERE `overall_status` = 'LEAD';
UPDATE `customers` SET `overall_status_new` = 'DANG_TIEP_CAN' WHERE `overall_status` = 'PROSPECT';
UPDATE `customers` SET `overall_status_new` = 'DANG_TU_VAN'   WHERE `overall_status` = 'ACTIVE';
UPDATE `customers` SET `overall_status_new` = 'KHONG_KHA_THI' WHERE `overall_status` = 'DORMANT';
UPDATE `customers` SET `overall_status_new` = 'KHONG_KHA_THI' WHERE `overall_status` = 'LOST';

-- 1c. Drop the old column
ALTER TABLE `customers` DROP COLUMN `overall_status`;

-- 1d. Add new column with updated enum type and default
ALTER TABLE `customers`
  ADD COLUMN `overall_status` ENUM('LEAD_MOI','DANG_TIEP_CAN','DANG_TU_VAN','THANH_CONG','KHONG_KHA_THI')
  NOT NULL DEFAULT 'LEAD_MOI';

-- 1e. Populate new column from staging column
UPDATE `customers` SET `overall_status` = `overall_status_new` WHERE `overall_status_new` IS NOT NULL;

-- 1f. Drop staging column
ALTER TABLE `customers` DROP COLUMN `overall_status_new`;

-- 1g. Recreate index (dropped with column)
CREATE INDEX `customers_overall_status_idx` ON `customers`(`overall_status`);


-- ===== STEP 2: Customer Priority Migration =====

-- 2a. Add a temporary staging column
ALTER TABLE `customers`
  ADD COLUMN `priority_new` VARCHAR(50) NULL;

-- 2b. Map old values → new values
--     Old HIGH and URGENT had business meaning (card/loan urgency).
--     Since they cannot be reliably mapped 1:1, migrate all existing priority
--     values to CHUA_CO_NHU_CAU (no current classification) to avoid
--     fabricating business meaning. Operators can re-classify after migration.
UPDATE `customers` SET `priority_new` = 'CHUA_CO_NHU_CAU' WHERE `priority` IS NOT NULL;

-- 2c. Drop the old column
ALTER TABLE `customers` DROP COLUMN `priority`;

-- 2d. Add new column with updated enum type and new default
ALTER TABLE `customers`
  ADD COLUMN `priority` ENUM('CHUA_CO_NHU_CAU','THANH_KHOAN','TIN_DUNG','THANH_KHOAN_TIN_DUNG')
  NULL DEFAULT 'CHUA_CO_NHU_CAU';

-- 2e. Populate new column from staging
UPDATE `customers` SET `priority` = `priority_new` WHERE `priority_new` IS NOT NULL;

-- 2f. Drop staging column
ALTER TABLE `customers` DROP COLUMN `priority_new`;


-- ===== STEP 3: Rename VIB source to "VIB Times City" =====
-- We preserve the existing row ID so all historical customer.source_id references remain valid.
-- Customers with source='VIB' (denormalized string cache) also get updated.
UPDATE `customer_sources`
  SET `name` = 'VIB Times City', `updated_at` = CURRENT_TIMESTAMP(3)
  WHERE `name` = 'VIB';

-- Update the denormalized source name cache on customer records
UPDATE `customers`
  SET `source` = 'VIB Times City'
  WHERE `source` = 'VIB';
