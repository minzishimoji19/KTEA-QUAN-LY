-- AlterTable
ALTER TABLE `customer_activities` MODIFY `type` ENUM('CONTACT', 'CALL', 'MESSAGE', 'MEETING', 'APPLICATION_CREATED', 'APPLICATION_UPDATED', 'STATUS_CHANGED', 'NEED_DETECTED', 'FOLLOW_UP', 'PUSH_CREATED', 'PUSH_RESULT', 'NOTE_CREATED', 'SYSTEM_EVENT', 'PUSH_SENT', 'NOTE', 'CREATE_CASE', 'SELECT_PRODUCT', 'PROGRESS_CHANGED', 'REJECTED', 'APPROVED', 'CARD_ISSUED', 'CARD_ACTIVATED', 'COMPLETED') NOT NULL;

-- AlterTable
ALTER TABLE `customer_cases` ADD COLUMN `progress` ENUM('NOT_SELECTED', 'REGISTRATION_CREATED', 'REGISTRATION_COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'CARD_ISSUED', 'CARD_ACTIVATED') NOT NULL DEFAULT 'NOT_SELECTED',
    ADD COLUMN `rejected_at` DATETIME(3) NULL,
    ADD COLUMN `rejection_note` TEXT NULL,
    ADD COLUMN `rejection_reason` TEXT NULL,
    MODIFY `product_id` VARCHAR(191) NULL,
    MODIFY `case_status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `source_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `recommendations` MODIFY `status` ENUM('NEW', 'REVIEWED', 'DISMISSED', 'CONVERTED_TO_PUSH', 'ACTIVE', 'ACCEPTED', 'EXPIRED') NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE `customer_sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_sources_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_progress_histories` (
    `id` VARCHAR(191) NOT NULL,
    `case_id` VARCHAR(191) NOT NULL,
    `from_progress` ENUM('NOT_SELECTED', 'REGISTRATION_CREATED', 'REGISTRATION_COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'CARD_ISSUED', 'CARD_ACTIVATED') NULL,
    `to_progress` ENUM('NOT_SELECTED', 'REGISTRATION_CREATED', 'REGISTRATION_COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'CARD_ISSUED', 'CARD_ACTIVATED') NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `case_progress_histories_case_id_idx`(`case_id`),
    INDEX `case_progress_histories_to_progress_idx`(`to_progress`),
    INDEX `case_progress_histories_changed_at_idx`(`changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `customer_cases_progress_idx` ON `customer_cases`(`progress`);

-- CreateIndex
CREATE INDEX `customers_source_id_idx` ON `customers`(`source_id`);

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `customer_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `case_progress_histories` ADD CONSTRAINT `case_progress_histories_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `customer_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotent Seed Default Sources: KTEA and VIB
INSERT INTO `customer_sources` (`id`, `name`, `active`, `created_at`, `updated_at`)
VALUES
  (UUID(), 'KTEA', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'VIB', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

-- Safe backfill: link any customer with matching source name to customer_sources
UPDATE `customers` c
JOIN `customer_sources` s ON c.`source` = s.`name`
SET c.`source_id` = s.`id`
WHERE c.`source_id` IS NULL;

