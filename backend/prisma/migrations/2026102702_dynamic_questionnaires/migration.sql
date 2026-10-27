-- Migration: 20261027_dynamic_questionnaires
-- Description: Dynamic Questionnaires & Questionnaire Versioning (Phase 2)
-- Additive migration: Preserves all existing tables and data.

-- 1. Create Questionnaires Table
CREATE TABLE IF NOT EXISTS `questionnaires` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `questionnaires_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Questionnaire Versions Table
CREATE TABLE IF NOT EXISTS `questionnaire_versions` (
  `id` VARCHAR(191) NOT NULL,
  `questionnaire_id` VARCHAR(191) NOT NULL,
  `version_number` INT NOT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `is_current` BOOLEAN NOT NULL DEFAULT FALSE,
  `title` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `change_log` TEXT NULL,
  `published_at` DATETIME(3) NULL,
  `published_by` VARCHAR(255) NULL,
  `created_by` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `questionnaire_versions_questionnaire_id_version_number_key` (`questionnaire_id`, `version_number`),
  INDEX `idx_qv_questionnaire_id` (`questionnaire_id`),
  INDEX `idx_qv_status` (`status`),
  INDEX `idx_qv_is_current` (`is_current`),
  CONSTRAINT `fk_qv_questionnaire` FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Question Definitions Table
CREATE TABLE IF NOT EXISTS `question_definitions` (
  `id` VARCHAR(191) NOT NULL,
  `version_id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `question_text` TEXT NOT NULL,
  `description` TEXT NULL,
  `question_type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO', 'NUMBER', 'CURRENCY', 'TEXT', 'LONG_TEXT', 'DATE') NOT NULL,
  `is_required` BOOLEAN NOT NULL DEFAULT FALSE,
  `display_order` INT NOT NULL DEFAULT 0,
  `options` JSON NULL,
  `validation_config` JSON NULL,
  `conditional_logic` JSON NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `question_definitions_version_id_code_key` (`version_id`, `code`),
  INDEX `idx_qd_version_id` (`version_id`),
  INDEX `idx_qd_display_order` (`display_order`),
  CONSTRAINT `fk_qd_version` FOREIGN KEY (`version_id`) REFERENCES `questionnaire_versions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
