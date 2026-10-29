-- =========================================================================
-- Migration: 2026102801_akinator_module_foundation
-- Purpose: Create isolated tables for Akinator module (Phase 2)
-- Safety: 100% additive (CREATE TABLE IF NOT EXISTS only). Zero existing tables altered.
-- =========================================================================

CREATE TABLE IF NOT EXISTS `akinator_config_versions` (
    `id`                        VARCHAR(191) NOT NULL,
    `version_number`            INTEGER      NOT NULL,
    `title`                     VARCHAR(191) NOT NULL,
    `description`               TEXT         NULL,
    `status`                    ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `is_current`                BOOLEAN      NOT NULL DEFAULT false,
    `max_questions_per_session` INTEGER      NOT NULL DEFAULT 15,
    `disclaimer_text`           TEXT         NOT NULL,
    `change_log`                TEXT         NULL,
    `published_at`              DATETIME(3)  NULL,
    `published_by_id`           VARCHAR(191) NULL,
    `created_by_id`             VARCHAR(191) NULL,
    `created_at`                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_config_versions_version_number_key`(`version_number`),
    INDEX `akinator_config_versions_status_idx`(`status`),
    INDEX `akinator_config_versions_is_current_idx`(`is_current`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_questions` (
    `id`                     VARCHAR(191) NOT NULL,
    `config_version_id`      VARCHAR(191) NOT NULL,
    `code`                   VARCHAR(191) NOT NULL,
    `question_text`          TEXT         NOT NULL,
    `description`            TEXT         NULL,
    `question_type`          ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO', 'NUMBER', 'CURRENCY', 'TEXT', 'DATE') NOT NULL,
    `is_entry_question`      BOOLEAN      NOT NULL DEFAULT false,
    `is_required_for_eval`   BOOLEAN      NOT NULL DEFAULT false,
    `priority_weight`        INTEGER      NOT NULL DEFAULT 50,
    `maps_to_customer_field` ENUM('NONE', 'FULL_NAME', 'PHONE', 'EMAIL', 'DOB', 'GENDER', 'ADDRESS') NOT NULL DEFAULT 'NONE',
    `options`                JSON         NULL,
    `validation_config`      JSON         NULL,
    `visibility_conditions`  JSON         NULL,
    `next_question_rules`    JSON         NULL,
    `active`                 BOOLEAN      NOT NULL DEFAULT true,
    `created_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_questions_config_version_id_code_key`(`config_version_id`, `code`),
    INDEX `akinator_questions_config_version_id_idx`(`config_version_id`),
    INDEX `akinator_questions_priority_weight_idx`(`priority_weight`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_rules` (
    `id`                      VARCHAR(191) NOT NULL,
    `config_version_id`       VARCHAR(191) NOT NULL,
    `code`                    VARCHAR(191) NOT NULL,
    `name`                    VARCHAR(191) NOT NULL,
    `description`             TEXT         NULL,
    `priority_order`          INTEGER      NOT NULL DEFAULT 1,
    `required_question_codes` JSON         NOT NULL,
    `conditions`              JSON         NOT NULL,
    `outcome_payload`         JSON         NOT NULL,
    `stop_on_match`           BOOLEAN      NOT NULL DEFAULT false,
    `active`                  BOOLEAN      NOT NULL DEFAULT true,
    `created_at`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_rules_config_version_id_code_key`(`config_version_id`, `code`),
    INDEX `akinator_rules_config_version_id_idx`(`config_version_id`),
    INDEX `akinator_rules_priority_order_idx`(`priority_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_sessions` (
    `id`                 VARCHAR(191) NOT NULL,
    `session_token_hash` VARCHAR(64)  NOT NULL,
    `config_version_id`  VARCHAR(191) NOT NULL,
    `quiz_status`        ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `workflow_status`    ENUM('PENDING_PROCESSING', 'IN_PROGRESS', 'NEEDS_MORE_INFO', 'PENDING_APPROVAL', 'APPROVED', 'TRANSFERRED', 'REJECTED') NULL,
    `raw_full_name`      VARCHAR(191) NULL,
    `raw_phone`          VARCHAR(191) NULL,
    `raw_email`          VARCHAR(191) NULL,
    `started_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at`       DATETIME(3)  NULL,
    `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_sessions_session_token_hash_key`(`session_token_hash`),
    INDEX `akinator_sessions_config_version_id_idx`(`config_version_id`),
    INDEX `akinator_sessions_quiz_status_idx`(`quiz_status`),
    INDEX `akinator_sessions_workflow_status_idx`(`workflow_status`),
    INDEX `akinator_sessions_raw_phone_idx`(`raw_phone`),
    INDEX `akinator_sessions_completed_at_idx`(`completed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_raw_answers` (
    `id`                     VARCHAR(191) NOT NULL,
    `session_id`             VARCHAR(191) NOT NULL,
    `question_id`            VARCHAR(191) NOT NULL,
    `question_code`          VARCHAR(191) NOT NULL,
    `question_text_snapshot` TEXT         NOT NULL,
    `answer_value`           JSON         NOT NULL,
    `answer_label_snapshot`  TEXT         NULL,
    `selection_reason`       TEXT         NULL,
    `step_order`             INTEGER      NOT NULL DEFAULT 1,
    `answered_at`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_raw_answers_session_id_question_code_key`(`session_id`, `question_code`),
    INDEX `akinator_raw_answers_session_id_idx`(`session_id`),
    INDEX `akinator_raw_answers_question_id_idx`(`question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_results` (
    `id`                     VARCHAR(191) NOT NULL,
    `session_id`             VARCHAR(191) NOT NULL,
    `config_version_id`      VARCHAR(191) NOT NULL,
    `evaluation_status`      ENUM('EVALUATED', 'INSUFFICIENT_DATA') NOT NULL,
    `summary_title`          VARCHAR(191) NOT NULL,
    `summary_description`    TEXT         NOT NULL,
    `outcome_data`           JSON         NOT NULL,
    `missing_criteria`       JSON         NOT NULL,
    `matched_rules_snapshot` JSON         NOT NULL,
    `answers_snapshot`       JSON         NOT NULL,
    `disclaimer_text`        TEXT         NOT NULL,
    `generated_at`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_results_session_id_key`(`session_id`),
    INDEX `akinator_results_config_version_id_idx`(`config_version_id`),
    INDEX `akinator_results_evaluation_status_idx`(`evaluation_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_admin_reviews` (
    `id`                   VARCHAR(191) NOT NULL,
    `session_id`           VARCHAR(191) NOT NULL,
    `edited_full_name`     VARCHAR(191) NULL,
    `edited_phone`         VARCHAR(191) NULL,
    `edited_email`         VARCHAR(191) NULL,
    `edited_gender`        ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `edited_date_of_birth` DATETIME(3)  NULL,
    `edited_address`       VARCHAR(191) NULL,
    `edited_source`        VARCHAR(191) NULL,
    `edited_priority`      ENUM('CHUA_CO_NHU_CAU', 'THANH_KHOAN', 'TIN_DUNG', 'THANH_KHOAN_TIN_DUNG') NULL,
    `processor_note`       TEXT         NULL,
    `missing_info_note`    TEXT         NULL,
    `approval_note`        TEXT         NULL,
    `rejection_reason`     TEXT         NULL,
    `assigned_admin_id`    VARCHAR(191) NULL,
    `approved_by_id`       VARCHAR(191) NULL,
    `approved_at`          DATETIME(3)  NULL,
    `rejected_by_id`       VARCHAR(191) NULL,
    `rejected_at`          DATETIME(3)  NULL,
    `linked_customer_id`   VARCHAR(191) NULL,
    `created_at`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `akinator_admin_reviews_session_id_key`(`session_id`),
    INDEX `akinator_admin_reviews_edited_phone_idx`(`edited_phone`),
    INDEX `akinator_admin_reviews_assigned_admin_id_idx`(`assigned_admin_id`),
    INDEX `akinator_admin_reviews_approved_by_id_idx`(`approved_by_id`),
    INDEX `akinator_admin_reviews_linked_customer_id_idx`(`linked_customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `akinator_status_histories` (
    `id`                      VARCHAR(191) NOT NULL,
    `session_id`              VARCHAR(191) NOT NULL,
    `from_status`             ENUM('PENDING_PROCESSING', 'IN_PROGRESS', 'NEEDS_MORE_INFO', 'PENDING_APPROVAL', 'APPROVED', 'TRANSFERRED', 'REJECTED') NULL,
    `to_status`               ENUM('PENDING_PROCESSING', 'IN_PROGRESS', 'NEEDS_MORE_INFO', 'PENDING_APPROVAL', 'APPROVED', 'TRANSFERRED', 'REJECTED') NOT NULL,
    `action_type`             VARCHAR(191) NOT NULL,
    `changed_fields_snapshot` JSON         NULL,
    `note`                    TEXT         NULL,
    `actor_user_id`           VARCHAR(191) NULL,
    `actor_email`             VARCHAR(191) NULL,
    `created_at`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `akinator_status_histories_session_id_idx`(`session_id`),
    INDEX `akinator_status_histories_to_status_idx`(`to_status`),
    INDEX `akinator_status_histories_actor_user_id_idx`(`actor_user_id`),
    INDEX `akinator_status_histories_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign Keys internal to Akinator Module
ALTER TABLE `akinator_questions` ADD CONSTRAINT `akinator_questions_config_version_id_fkey`
    FOREIGN KEY (`config_version_id`) REFERENCES `akinator_config_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `akinator_rules` ADD CONSTRAINT `akinator_rules_config_version_id_fkey`
    FOREIGN KEY (`config_version_id`) REFERENCES `akinator_config_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `akinator_sessions` ADD CONSTRAINT `akinator_sessions_config_version_id_fkey`
    FOREIGN KEY (`config_version_id`) REFERENCES `akinator_config_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `akinator_raw_answers` ADD CONSTRAINT `akinator_raw_answers_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `akinator_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `akinator_raw_answers` ADD CONSTRAINT `akinator_raw_answers_question_id_fkey`
    FOREIGN KEY (`question_id`) REFERENCES `akinator_questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `akinator_results` ADD CONSTRAINT `akinator_results_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `akinator_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `akinator_admin_reviews` ADD CONSTRAINT `akinator_admin_reviews_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `akinator_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `akinator_status_histories` ADD CONSTRAINT `akinator_status_histories_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `akinator_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
