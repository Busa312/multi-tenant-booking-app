-- R160: the city translates like the address line it follows, so a translated
-- address doesn't end in the default-language city name.
ALTER TABLE "location" ADD COLUMN "city_i18n" JSONB;
