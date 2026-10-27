-- Phase 4: Assessment Recommendation Engine Additive Migration
-- Deterministic & Explainable Recommendation Engine
-- Safe MySQL Additive DDL with IF NOT EXISTS and ON DELETE RESTRICT

CREATE TABLE IF NOT EXISTS `assessment_recommendation_rule_sets` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assessment_recommendation_rule_sets_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assessment_recommendation_rule_versions` (
    `id` VARCHAR(191) NOT NULL,
    `rule_set_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `rules` JSON NOT NULL,
    `change_log` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `published_by` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `assessment_recommendation_rule_versions_rule_set_id_idx`(`rule_set_id`),
    INDEX `assessment_recommendation_rule_versions_status_idx`(`status`),
    INDEX `assessment_recommendation_rule_versions_is_current_idx`(`is_current`),
    UNIQUE INDEX `assessment_recommendation_rule_versions_rule_set_id_version_key`(`rule_set_id`, `version_number`),
    PRIMARY KEY (`id`),
    CONSTRAINT `assessment_recommendation_rule_versions_rule_set_id_fkey` FOREIGN KEY (`rule_set_id`) REFERENCES `assessment_recommendation_rule_sets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assessment_recommendation_runs` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `assessment_id` VARCHAR(191) NOT NULL,
    `rule_version_id` VARCHAR(191) NOT NULL,
    `performed_by_id` VARCHAR(191) NULL,
    `status` ENUM('COMPLETED', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
    `answers_snapshot` JSON NOT NULL,
    `rules_snapshot` JSON NOT NULL,
    `total_candidates_evaluated` INTEGER NOT NULL DEFAULT 0,
    `total_recommended` INTEGER NOT NULL DEFAULT 0,
    `execution_time_ms` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `assessment_recommendation_runs_customer_id_idx`(`customer_id`),
    INDEX `assessment_recommendation_runs_assessment_id_idx`(`assessment_id`),
    INDEX `assessment_recommendation_runs_rule_version_id_idx`(`rule_version_id`),
    INDEX `assessment_recommendation_runs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `assessment_recommendation_runs_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `assessment_recommendation_runs_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `assessment_recommendation_runs_rule_version_id_fkey` FOREIGN KEY (`rule_version_id`) REFERENCES `assessment_recommendation_rule_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `assessment_recommendation_runs_performed_by_id_fkey` FOREIGN KEY (`performed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assessment_recommendation_items` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `product_code` VARCHAR(191) NOT NULL,
    `product_category` ENUM('LOAN_UNSECURED', 'LOAN_SECURED', 'CREDIT_CARD', 'INSURANCE', 'SAVINGS', 'OTHER') NOT NULL,
    `product_snapshot` JSON NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `rank` INTEGER NOT NULL DEFAULT 1,
    `confidence` INTEGER NOT NULL DEFAULT 100,
    `is_eligible` BOOLEAN NOT NULL DEFAULT true,
    `match_summary` TEXT NOT NULL,
    `passed_criteria` JSON NOT NULL,
    `failed_criteria` JSON NOT NULL,
    `unassessed_criteria` JSON NOT NULL,
    `warnings` JSON NOT NULL,
    `answers_used` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `run_product_unique`(`run_id`, `product_id`),
    INDEX `assessment_recommendation_items_run_id_idx`(`run_id`),
    INDEX `assessment_recommendation_items_product_id_idx`(`product_id`),
    INDEX `assessment_recommendation_items_score_idx`(`score`),
    INDEX `assessment_recommendation_items_is_eligible_idx`(`is_eligible`),
    PRIMARY KEY (`id`),
    CONSTRAINT `assessment_recommendation_items_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `assessment_recommendation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `assessment_recommendation_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
