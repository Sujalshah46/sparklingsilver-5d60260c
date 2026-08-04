// Slim column list for product grids. Selecting `*` pulled description,
// the full `images` array and import bookkeeping columns for every card,
// which dominated the JSON payload on catalogue/subcategory pages.
// Keep this in sync with CatalogueCardData + the sort/filter fields used
// by the grid pages.
export const CARD_COLUMNS =
  "id,slug,sku,name,purity,metal,gross_weight,image_url,image_variants,category_id,subcategory_id,is_new,is_bestseller,homepage_featured,homepage_featured_order,created_at";
