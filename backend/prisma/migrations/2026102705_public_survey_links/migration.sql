-- =========================================================================
-- Migration: public_survey_links
-- Purpose: Add PublicSurveyLink table for customer self-service questionnaire
-- Safe: Additive only (new table + FK), no existing data modified
-- =========================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS `public_survey_links` (
    `id`               VARCHAR(191)                                    NOT NULL,
    `token_hash`       VARCHAR(64)                                     NOT NULL,
    `assessment_id`    VARCHAR(191)                                    NOT NULL,
    `created_by_id`    VARCHAR(191)                                    NULL,
    `status`           ENUM('ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `expires_at`       DATETIME(3)                                     NOT NULL,
    `revoked_at`       DATETIME(3)                                     NULL,
    `revoked_by_id`    VARCHAR(191)                                    NULL,
    `completed_at`     DATETIME(3)                                     NULL,
    `last_accessed_at` DATETIME(3)                                     NULL,
    `created_at`       DATETIME(3)                                     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`       DATETIME(3)                                     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `public_survey_links_token_hash_key`(`token_hash`),
    UNIQUE INDEX `public_survey_links_assessment_id_key`(`assessment_id`),
    INDEX `public_survey_links_token_hash_idx`(`token_hash`),
    INDEX `public_survey_links_assessment_id_idx`(`assessment_id`),
    INDEX `public_survey_links_status_idx`(`status`),
    INDEX `public_survey_links_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `public_survey_links` ADD CONSTRAINT `public_survey_links_assessment_id_fkey`
    FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `public_survey_links` ADD CONSTRAINT `public_survey_links_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `public_survey_links` ADD CONSTRAINT `public_survey_links_revoked_by_id_fkey`
    FOREIGN KEY (`revoked_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
