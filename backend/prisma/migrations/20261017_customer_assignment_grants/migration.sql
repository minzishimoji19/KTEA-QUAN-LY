-- CreateTable: customer_assignment_grants
CREATE TABLE IF NOT EXISTS `customer_assignment_grants` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `source_type` ENUM('DIRECT', 'CARE_SCHEDULE') NOT NULL,
    `source_id` VARCHAR(191) NOT NULL DEFAULT 'DIRECT',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `assigned_by_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_user_source_unique`(`customer_id`, `user_id`, `source_type`, `source_id`),
    INDEX `customer_assignment_grants_user_id_idx`(`user_id`),
    INDEX `customer_assignment_grants_customer_id_idx`(`customer_id`),
    INDEX `customer_assignment_grants_source_id_idx`(`source_id`),
    INDEX `customer_assignment_grants_active_idx`(`active`),
    PRIMARY KEY (`id`),
    CONSTRAINT `customer_assignment_grants_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `customer_assignment_grants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `customer_assignment_grants_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
