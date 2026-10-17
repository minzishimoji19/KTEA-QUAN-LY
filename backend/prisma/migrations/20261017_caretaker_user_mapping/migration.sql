-- AlterTable: caretakers
ALTER TABLE `caretakers` ADD COLUMN `user_id` VARCHAR(191) NULL;

-- CreateIndex: unique constraint on caretakers.user_id
ALTER TABLE `caretakers` ADD UNIQUE INDEX `caretakers_user_id_key`(`user_id`);

-- CreateIndex: index on caretakers.user_id
ALTER TABLE `caretakers` ADD INDEX `caretakers_user_id_idx`(`user_id`);

-- AddForeignKey: caretakers.user_id -> users.id
ALTER TABLE `caretakers` ADD CONSTRAINT `caretakers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
