ALTER TABLE `CashMovement`
    ADD COLUMN `stockMovementId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `CashMovement_stockMovementId_key` ON `CashMovement`(`stockMovementId`);

ALTER TABLE `CashMovement`
    ADD CONSTRAINT `CashMovement_stockMovementId_fkey`
    FOREIGN KEY (`stockMovementId`) REFERENCES `StockMovement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
