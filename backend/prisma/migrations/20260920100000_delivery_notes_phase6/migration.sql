-- AlterTable
ALTER TABLE `Signature` ADD COLUMN `type` ENUM('DELIVERED_BY', 'RECEIVED_BY') NOT NULL;

-- CreateTable
CREATE TABLE `DocumentSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 1,

    INDEX `DocumentSequence_eventId_documentType_idx`(`eventId`, `documentType`),
    UNIQUE INDEX `DocumentSequence_companyId_eventId_documentType_key`(`companyId`, `eventId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryNoteEmail` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryNoteId` VARCHAR(191) NOT NULL,
    `sentByUserId` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SENT', 'FAILED') NOT NULL,
    `error` TEXT NULL,

    INDEX `DeliveryNoteEmail_deliveryNoteId_sentAt_idx`(`deliveryNoteId`, `sentAt`),
    INDEX `DeliveryNoteEmail_sentByUserId_sentAt_idx`(`sentByUserId`, `sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Signature_deliveryNoteId_type_key` ON `Signature`(`deliveryNoteId`, `type`);

-- AddForeignKey
ALTER TABLE `DocumentSequence` ADD CONSTRAINT `DocumentSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNoteEmail` ADD CONSTRAINT `DeliveryNoteEmail_deliveryNoteId_fkey` FOREIGN KEY (`deliveryNoteId`) REFERENCES `DeliveryNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryNoteEmail` ADD CONSTRAINT `DeliveryNoteEmail_sentByUserId_fkey` FOREIGN KEY (`sentByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
