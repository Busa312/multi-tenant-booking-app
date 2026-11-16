-- R440: whether customers pick who serves them online. Default true, so every
-- existing tenant keeps the professional step it has today.
ALTER TABLE "tenant" ADD COLUMN "customers_choose_professional" BOOLEAN NOT NULL DEFAULT true;
