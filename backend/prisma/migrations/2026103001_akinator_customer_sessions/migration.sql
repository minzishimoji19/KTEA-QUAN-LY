-- =========================================================================
-- Migration: 2026103001_akinator_customer_sessions
-- Purpose: Add Customer-linked Akinator sessions, source_type, expiry, and revocation tracking
-- Safety: 100% additive / non-destructive ALTER TABLE additions
-- =========================================================================

-- 1. Alter quiz_status ENUM to include NOT_STARTED, EXPIRED, REVOKED
ALTER TABLE `akinator_sessions` 
    MODIFY COLUMN `quiz_status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'IN_PROGRESS';

-- 2. Add columns to akinator_sessions
ALTER TABLE `akinator_sessions`
    ADD COLUMN `source_type` ENUM('PUBLIC_WALK_IN', 'CRM_CUSTOMER_LINK') NOT NULL DEFAULT 'PUBLIC_WALK_IN',
    ADD COLUMN `customer_id` VARCHAR(191) NULL,
    ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `last_accessed_at` DATETIME(3) NULL,
    ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `revoked_at` DATETIME(3) NULL,
    ADD COLUMN `revoked_by_id` VARCHAR(191) NULL;

-- 3. Add Indexes
ALTER TABLE `akinator_sessions`
    ADD INDEX `akinator_sessions_source_type_idx`(`source_type`),
    ADD INDEX `akinator_sessions_customer_id_quiz_status_completed_at_idx`(`customer_id`, `quiz_status`, `completed_at`),
    ADD INDEX `akinator_sessions_customer_id_created_at_idx`(`customer_id`, `created_at`),
    ADD INDEX `akinator_sessions_created_by_id_idx`(`created_by_id`);

-- 4. Add Foreign Keys
ALTER TABLE `akinator_sessions`
    ADD CONSTRAINT `akinator_sessions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `akinator_sessions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `akinator_sessions_revoked_by_id_fkey` FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
