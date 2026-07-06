INSERT INTO public.subcategories (name, slug, sort_order, image_url) VALUES
  ('BAJU','baju',1,'subcat-baju.jpg'),
  ('BANGLE','bangle',2,'subcat-bangle.jpg'),
  ('BELT','belt',3,'subcat-belt.jpg'),
  ('BRACELET','bracelet',4,'subcat-bracelet.jpg'),
  ('BRIDAL','bridal',5,'subcat-bridal.jpg'),
  ('BROOCH','brooch',6,'subcat-brooch.jpg'),
  ('Choker/Chik','choker-chik',7,'subcat-choker-chik.jpg'),
  ('CHOTI','choti',8,'subcat-choti.jpg'),
  ('EARRINGS','earrings',9,'subcat-earrings.jpg'),
  ('Finger Ring','finger-ring',10,'subcat-finger-ring.jpg'),
  ('JHUMKA','jhumka',11,'subcat-jhumka.jpg'),
  ('LONG SET','long-set',12,'subcat-long-set.jpg'),
  ('MANGAL SUTRA','mangal-sutra',13,'subcat-mangal-sutra.jpg'),
  ('MATIL','matil',14,'subcat-matil.jpg'),
  ('NECKLACE','necklace',15,'subcat-necklace.jpg'),
  ('PENDANT SET','pendant-set',16,'subcat-pendant-set.jpg'),
  ('SPN','spn',17,'subcat-spn.jpg'),
  ('TIKKA','tikka',18,'subcat-tikka.jpg'),
  ('TOPS','tops',19,'subcat-tops.jpg'),
  ('VENKY','venky',20,'subcat-venky.jpg')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  image_url = EXCLUDED.image_url;

INSERT INTO public.category_subcategories (category_id, subcategory_id)
SELECT c.id, s.id
FROM public.categories c
CROSS JOIN public.subcategories s
ON CONFLICT DO NOTHING;
