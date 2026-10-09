ALTER TABLE `CashSession`
  ADD COLUMN `settledAt` DATETIME(3) NULL,
  ADD COLUMN `settledByUserId` VARCHAR(191) NULL,
  ADD COLUMN `settlementAmount` DECIMAL(12,2) NULL;

ALTER TABLE `CashSession`
  ADD CONSTRAINT `CashSession_settledByUserId_fkey`
  FOREIGN KEY (`settledByUserId`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `CashSession_companyId_eventId_settledAt_idx`
  ON `CashSession`(`companyId`, `eventId`, `settledAt`);
