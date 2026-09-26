CREATE TABLE `CashTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `originSessionId` VARCHAR(191) NOT NULL,
    `destinationSessionId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `concept` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `CashTransfer_companyId_eventId_createdAt_idx`(`companyId`, `eventId`, `createdAt`),
    INDEX `CashTransfer_originSessionId_createdAt_idx`(`originSessionId`, `createdAt`),
    INDEX `CashTransfer_destinationSessionId_createdAt_idx`(`destinationSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CashMovement` ADD COLUMN `cashTransferId` VARCHAR(191) NULL;
CREATE INDEX `CashMovement_cashTransferId_idx` ON `CashMovement`(`cashTransferId`);

ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_originSessionId_fkey` FOREIGN KEY (`originSessionId`) REFERENCES `CashSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_destinationSessionId_fkey` FOREIGN KEY (`destinationSessionId`) REFERENCES `CashSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_cashTransferId_fkey` FOREIGN KEY (`cashTransferId`) REFERENCES `CashTransfer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
