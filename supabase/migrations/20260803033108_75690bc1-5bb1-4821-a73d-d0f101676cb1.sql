UPDATE public.profiles
SET full_name = 'App Review',
    contact_person = 'App Review',
    business_name = 'Apple Review Demo',
    mobile = '9330615237',
    city = 'Mumbai',
    business_type = 'retailer',
    gstin = '27AAPCS1234A1Z5',
    delivery_address = 'Sparkling Silver Demo Buyer, 12 Zaveri Bazaar Road, Mumbai, Maharashtra 400003',
    additional_remarks = 'Store review demo account. Do not delete.',
    profile_completed = true,
    must_change_password = false,
    status = 'active'
WHERE email = 'appstore.review@sparklingsilver.in';

INSERT INTO public.addresses (user_id, label, recipient_name, mobile, line1, city, state, pincode, is_default)
SELECT p.id, 'Demo', 'App Review', '9330615237', '12 Zaveri Bazaar Road', 'Mumbai', 'Maharashtra', '400003', true
FROM public.profiles p
WHERE p.email = 'appstore.review@sparklingsilver.in'
  AND NOT EXISTS (SELECT 1 FROM public.addresses a WHERE a.user_id = p.id);