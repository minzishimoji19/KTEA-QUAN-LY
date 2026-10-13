-- CreateTable
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `device_name` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `push_subscriptions_endpoint_key`(`endpoint`),
    INDEX `push_subscriptions_recipient_idx`(`recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `push_notification_logs` (
    `id` VARCHAR(191) NOT NULL,
    `follow_up_id` VARCHAR(191) NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SENT',
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `push_notification_logs_follow_up_id_idx`(`follow_up_id`),
    INDEX `push_notification_logs_recipient_idx`(`recipient`),
    INDEX `push_notification_logs_sent_at_idx`(`sent_at`),
    UNIQUE INDEX `push_notification_logs_follow_up_id_event_type_recipient_key`(`follow_up_id`, `event_type`, `recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
