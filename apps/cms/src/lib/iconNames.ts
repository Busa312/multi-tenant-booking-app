/**
 * Every Material Symbols icon the CMS draws. The icon font is a subset that
 * contains exactly these glyphs (scripts/build-icon-font.mjs), so an icon not
 * listed here would render as its ligature text. `IconName` makes that a type
 * error instead: add the name here, then re-run `pnpm --filter @booking/cms icons`.
 *
 * Keep it sorted — Google Fonts' `icon_names` parameter requires that order.
 */
export const ICON_NAMES = [
  "add",
  "arrow_forward",
  "block",
  "check",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "content_copy",
  "content_cut",
  "credit_card",
  "dark_mode",
  "delete",
  "design_services",
  "diversity_3",
  "edit",
  "edit_calendar",
  "edit_note",
  "error",
  "event_available",
  "event_busy",
  "expand_more",
  "flag",
  "info",
  "light_mode",
  "location_off",
  "location_on",
  "lock",
  "logout",
  "mail",
  "menu",
  "more_vert",
  "my_location",
  "open_in_new",
  "palette",
  "person",
  "person_add",
  "person_off",
  "refresh",
  "schedule",
  "space_dashboard",
  "storefront",
  "undo",
  "update",
  "visibility",
  "visibility_off",
  "warning",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
