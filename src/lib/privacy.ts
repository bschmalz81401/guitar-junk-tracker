/**
 * Pure visibility rules for public catalogs and sensitive ownership fields.
 * Keep these free of Prisma/Next so agents and CI can unit-test them.
 */

/** Guest may open /{username} only when the owner opted in. */
export function isCatalogPubliclyAccessible(
  catalogPublic: boolean | null | undefined
): boolean {
  return catalogPublic === true;
}

/**
 * Whether the price-paid value may be shown to the current viewer.
 * Owners always see it when set; public viewers only when pricePaidPublic.
 */
export function canRevealPricePaid(input: {
  viewerIsOwner: boolean;
  pricePaid: number | null | undefined;
  pricePaidPublic: boolean;
}): boolean {
  if (input.pricePaid == null) return false;
  return input.viewerIsOwner || input.pricePaidPublic;
}

/**
 * Whether the serial number may be shown to the current viewer.
 * Owners always see it when set; public viewers only when serialNumberPublic.
 */
export function canRevealSerialNumber(input: {
  viewerIsOwner: boolean;
  serialNumber: string | null | undefined;
  serialNumberPublic: boolean;
}): boolean {
  if (!input.serialNumber) return false;
  return input.viewerIsOwner || input.serialNumberPublic;
}
