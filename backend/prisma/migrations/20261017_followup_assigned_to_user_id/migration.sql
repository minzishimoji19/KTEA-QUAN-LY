-- AlterTable: follow_ups add assigned_to_user_id
ALTER TABLE `follow_ups` ADD COLUMN `assigned_to_user_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `follow_ups_assigned_to_user_id_idx` ON `follow_ups`(`assigned_to_user_id`);

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
