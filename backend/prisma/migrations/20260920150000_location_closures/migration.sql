CREATE TABLE `LocationClosure` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `destinationLocationId` VARCHAR(191) NOT NULL,
    `stockMovementId` VARCHAR(191) NOT NULL,
    `closedByUserId` VARCHAR(191) NOT NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    UNIQUE INDEX `LocationClosure_stockMovementId_key`(`stockMovementId`),
    INDEX `LocationClosure_companyId_eventId_locationId_idx`(`companyId`, `eventId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_destinationLocationId_fkey` FOREIGN KEY (`destinationLocationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_stockMovementId_fkey` FOREIGN KEY (`stockMovementId`) REFERENCES `StockMovement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LocationClosure` ADD CONSTRAINT `LocationClosure_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
