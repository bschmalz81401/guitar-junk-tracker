-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "catalogPublic" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "allowSignup" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "smtpFrom" TEXT,
    "showcaseEmail" TEXT,
    "sessionSecret" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'guitar',
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "series" TEXT,
    "finishColor" TEXT,
    "dateAcquired" DATETIME,
    "acquisitionSource" TEXT,
    "pricePaid" REAL,
    "pricePaidPublic" BOOLEAN NOT NULL DEFAULT false,
    "serialNumber" TEXT,
    "serialNumberPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'owned',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuitarSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "bodyShape" TEXT,
    "bodyWood" TEXT,
    "bodyTopWood" TEXT,
    "bodyBinding" TEXT,
    "neckConstruction" TEXT,
    "neckWood" TEXT,
    "neckShape" TEXT,
    "scaleLength" TEXT,
    "neckBinding" TEXT,
    "fingerboardWood" TEXT,
    "fingerboardRadius" TEXT,
    "fretCount" INTEGER,
    "fretSize" TEXT,
    "nutWidth" TEXT,
    "nutMaterial" TEXT,
    "inlayMaterial" TEXT,
    "inlayStyle" TEXT,
    "bridgeType" TEXT,
    "tunerType" TEXT,
    "hardwareColor" TEXT,
    "bridgePickup" TEXT,
    "neckPickup" TEXT,
    "pickupType" TEXT,
    "controls" TEXT,
    "weightLbs" REAL,
    "caseIncluded" BOOLEAN NOT NULL DEFAULT false,
    "caseType" TEXT,
    CONSTRAINT "GuitarSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AmpSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "formFactor" TEXT,
    "ampType" TEXT,
    "wattage" REAL,
    "channels" INTEGER,
    "preampTubes" TEXT,
    "powerTubes" TEXT,
    "rectifier" TEXT,
    "speakerCount" INTEGER,
    "speakerSize" TEXT,
    "speakerModel" TEXT,
    "impedance" TEXT,
    "eqControls" TEXT,
    "reverb" TEXT,
    "effectsLoop" BOOLEAN NOT NULL DEFAULT false,
    "masterVolume" BOOLEAN NOT NULL DEFAULT false,
    "boost" BOOLEAN NOT NULL DEFAULT false,
    "footswitch" TEXT,
    "midi" BOOLEAN NOT NULL DEFAULT false,
    "attenuator" BOOLEAN NOT NULL DEFAULT false,
    "diOut" BOOLEAN NOT NULL DEFAULT false,
    "cabSim" BOOLEAN NOT NULL DEFAULT false,
    "weightLbs" REAL,
    "dimensions" TEXT,
    "covering" TEXT,
    "grilleCloth" TEXT,
    CONSTRAINT "AmpSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CabSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "speakerCount" INTEGER,
    "speakerSize" TEXT,
    "speakerModel" TEXT,
    "cabType" TEXT,
    "impedance" TEXT,
    "powerHandling" REAL,
    "wiring" TEXT,
    "inputJacks" TEXT,
    "stereoCapable" BOOLEAN NOT NULL DEFAULT false,
    "cabWood" TEXT,
    "baffle" TEXT,
    "covering" TEXT,
    "grilleCloth" TEXT,
    "hardware" TEXT,
    "casters" BOOLEAN NOT NULL DEFAULT false,
    "weightLbs" REAL,
    "dimensions" TEXT,
    CONSTRAINT "CabSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PedalSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "effectType" TEXT,
    "circuitType" TEXT,
    "trueBypass" BOOLEAN NOT NULL DEFAULT false,
    "knobs" TEXT,
    "switches" TEXT,
    "presets" TEXT,
    "expressionInput" BOOLEAN NOT NULL DEFAULT false,
    "tapTempo" BOOLEAN NOT NULL DEFAULT false,
    "inputs" TEXT,
    "outputs" TEXT,
    "stereo" BOOLEAN NOT NULL DEFAULT false,
    "midi" BOOLEAN NOT NULL DEFAULT false,
    "powerRequired" TEXT,
    "currentDraw" INTEGER,
    "batteryOption" BOOLEAN NOT NULL DEFAULT false,
    "enclosureSize" TEXT,
    "dimensions" TEXT,
    "weightLbs" REAL,
    CONSTRAINT "PedalSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MultiFxSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "ampModels" TEXT,
    "effectModels" TEXT,
    "presets" TEXT,
    "processingBlocks" TEXT,
    "signalFlowOptions" TEXT,
    "snapshots" TEXT,
    "impulseResponses" TEXT,
    "globalEqBands" TEXT,
    "mainDisplay" TEXT,
    "footswitches" TEXT,
    "footswitchModes" TEXT,
    "footswitchTypes" TEXT,
    "looperTypes" TEXT,
    "looperMemoryFull" TEXT,
    "looperMemoryHalf" TEXT,
    "quarterInchInputs" TEXT,
    "quarterInchOutputs" TEXT,
    "xlrInputs" TEXT,
    "xlrOutputs" TEXT,
    "effectLoops" TEXT,
    "digitalIn" TEXT,
    "digitalOut" TEXT,
    "headphones" TEXT,
    "midi" TEXT,
    "usbAudioInterface" TEXT,
    "masterRemoteControl" TEXT,
    "variableImpedance" TEXT,
    "chassis" TEXT,
    "treadle" TEXT,
    "scribbleStripLcds" TEXT,
    "expPedalInputs" TEXT,
    "externalAmpControl" TEXT,
    "wirelessTransmitter" TEXT,
    "wirelessReceiver" TEXT,
    "power" TEXT,
    "height" TEXT,
    "width" TEXT,
    "depth" TEXT,
    "weightLbs" TEXT,
    CONSTRAINT "MultiFxSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtherSpec" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "itemType" TEXT,
    "material" TEXT,
    "powerRequired" TEXT,
    "dimensions" TEXT,
    "weightLbs" REAL,
    "details" TEXT,
    CONSTRAINT "OtherSpec_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "caption" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mod_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "Item_userId_category_idx" ON "Item"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "GuitarSpec_itemId_key" ON "GuitarSpec"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AmpSpec_itemId_key" ON "AmpSpec"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CabSpec_itemId_key" ON "CabSpec"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PedalSpec_itemId_key" ON "PedalSpec"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiFxSpec_itemId_key" ON "MultiFxSpec"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "OtherSpec_itemId_key" ON "OtherSpec"("itemId");

