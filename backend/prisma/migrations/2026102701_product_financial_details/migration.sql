-- CreateTable
CREATE TABLE IF NOT EXISTS `product_financial_details` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `category` ENUM('LOAN_UNSECURED', 'LOAN_SECURED', 'CREDIT_CARD', 'INSURANCE', 'SAVINGS', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `provider_name` VARCHAR(191) NULL,
    `min_amount` DECIMAL(15, 2) NULL,
    `max_amount` DECIMAL(15, 2) NULL,
    `min_interest_rate` DECIMAL(5, 2) NULL,
    `max_interest_rate` DECIMAL(5, 2) NULL,
    `interest_rate_unit` ENUM('PERCENT_PER_YEAR', 'PERCENT_PER_MONTH') NOT NULL DEFAULT 'PERCENT_PER_YEAR',
    `min_tenure_months` INTEGER NULL,
    `max_tenure_months` INTEGER NULL,
    `fees_description` TEXT NULL,
    `min_age` INTEGER NULL,
    `max_age` INTEGER NULL,
    `min_income` DECIMAL(15, 2) NULL,
    `accept_bad_debt` BOOLEAN NOT NULL DEFAULT false,
    `eligibility_criteria` JSON NULL,
    `benefits` JSON NULL,
    `risks` JSON NULL,
    `official_url` VARCHAR(500) NULL,
    `effective_from` DATETIME(3) NULL,
    `effective_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_financial_details_product_id_key`(`product_id`),
    INDEX `product_financial_details_category_idx`(`category`),
    INDEX `product_financial_details_provider_name_idx`(`provider_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_financial_details` ADD CONSTRAINT `product_financial_details_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
