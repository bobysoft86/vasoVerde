CREATE TABLE `IdempotencyRecord` (
    `scopeHash` CHAR(64) NOT NULL,
    `bodyHash` CHAR(64) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` TEXT NOT NULL,
    `state` VARCHAR(16) NOT NULL,
    `statusCode` INTEGER NULL,
    `responseBody` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `IdempotencyRecord_companyId_createdAt_idx` (`companyId`, `createdAt`),
    PRIMARY KEY (`scopeHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
