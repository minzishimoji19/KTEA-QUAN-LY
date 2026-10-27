-- Migration: 20261027_customer_assessments
-- Description: Customer Needs Assessment & Answer Storage (Phase 3)
-- Additive migration: Preserves all existing tables and data.

-- 1. Create Assessments Table
CREATE TABLE IF NOT EXISTS `assessments` (
  `id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `questionnaire_version_id` VARCHAR(191) NOT NULL,
  `status` ENUM('IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  `performed_by_id` VARCHAR(191) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_assessment_customer_id` (`customer_id`),
  INDEX `idx_assessment_version_id` (`questionnaire_version_id`),
  INDEX `idx_assessment_status` (`status`),
  INDEX `idx_assessment_started_at` (`started_at`),
  CONSTRAINT `fk_assessment_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_assessment_version` FOREIGN KEY (`questionnaire_version_id`) REFERENCES `questionnaire_versions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_assessment_user` FOREIGN KEY (`performed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Assessment Answers Table
CREATE TABLE IF NOT EXISTS `assessment_answers` (
  `id` VARCHAR(191) NOT NULL,
  `assessment_id` VARCHAR(191) NOT NULL,
  `question_id` VARCHAR(191) NULL,
  `question_code` VARCHAR(191) NOT NULL,
  `answer_value` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `assessment_question_unique` (`assessment_id`, `question_code`),
  INDEX `idx_answer_assessment_id` (`assessment_id`),
  INDEX `idx_answer_question_code` (`question_code`),
  CONSTRAINT `fk_answer_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
