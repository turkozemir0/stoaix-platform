-- Migration: Lead Form İlk Temas template preset'leri
-- Purpose: first_contact — Meta Lead Form'dan gelen leadlere ilk temas WA mesajı
-- Parametreler: {{1}} = ad soyad, {{2}} = ilgi alanı / hizmet
-- Çalıştırma: Supabase Dashboard → SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- DENTAL — TR + EN
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.message_templates
  (organization_id, name, language, category, components, status, is_preset, sector, purpose)
VALUES

(NULL, 'dental_first_contact_v1_tr', 'tr', 'MARKETING',
  '[{"type":"BODY","text":"Merhaba {{1}}, formumuzu doldurduğunuz için teşekkür ederiz! {{2}} hakkında bilgi almak istediğinizi gördük. En kısa sürede sizinle iletişime geçeceğiz. Herhangi bir sorunuz varsa buradan yazabilirsiniz."}]',
  'draft', true, 'dental', 'first_contact'),

(NULL, 'dental_first_contact_v1_en', 'en', 'MARKETING',
  '[{"type":"BODY","text":"Hi {{1}}, thank you for filling out our form! We noticed you are interested in {{2}}. We will reach out to you shortly. Feel free to message us here if you have any questions."}]',
  'draft', true, 'dental', 'first_contact')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HAIR — TR + EN
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.message_templates
  (organization_id, name, language, category, components, status, is_preset, sector, purpose)
VALUES

(NULL, 'hair_first_contact_v1_tr', 'tr', 'MARKETING',
  '[{"type":"BODY","text":"Merhaba {{1}}, formumuzu doldurduğunuz için teşekkür ederiz! {{2}} hakkında bilgi almak istediğinizi gördük. Uzman ekibimiz en kısa sürede sizinle iletişime geçecek. Sorularınız için buradan yazabilirsiniz."}]',
  'draft', true, 'hair', 'first_contact'),

(NULL, 'hair_first_contact_v1_en', 'en', 'MARKETING',
  '[{"type":"BODY","text":"Hi {{1}}, thank you for your inquiry! We see you are interested in {{2}}. Our specialist team will contact you shortly. Feel free to message us here with any questions."}]',
  'draft', true, 'hair', 'first_contact')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- AESTHETICS — TR + EN
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.message_templates
  (organization_id, name, language, category, components, status, is_preset, sector, purpose)
VALUES

(NULL, 'aesthetics_first_contact_v1_tr', 'tr', 'MARKETING',
  '[{"type":"BODY","text":"Merhaba {{1}}, formumuzu doldurduğunuz için teşekkür ederiz! {{2}} ile ilgilendiğinizi gördük. Uzman danışmanlarımız en kısa sürede sizinle iletişime geçecek. Sorularınız için buradan yazabilirsiniz."}]',
  'draft', true, 'aesthetics', 'first_contact'),

(NULL, 'aesthetics_first_contact_v1_en', 'en', 'MARKETING',
  '[{"type":"BODY","text":"Hi {{1}}, thank you for reaching out! We noticed you are interested in {{2}}. Our expert consultants will get in touch with you shortly. Feel free to message us here if you have any questions."}]',
  'draft', true, 'aesthetics', 'first_contact')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- GENERAL — TR + EN
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.message_templates
  (organization_id, name, language, category, components, status, is_preset, sector, purpose)
VALUES

(NULL, 'general_first_contact_v1_tr', 'tr', 'MARKETING',
  '[{"type":"BODY","text":"Merhaba {{1}}, formumuzu doldurduğunuz için teşekkür ederiz! {{2}} hakkında bilgi almak istediğinizi gördük. Ekibimiz en kısa sürede sizinle iletişime geçecek. Sorularınız için buradan yazabilirsiniz."}]',
  'draft', true, 'general', 'first_contact'),

(NULL, 'general_first_contact_v1_en', 'en', 'MARKETING',
  '[{"type":"BODY","text":"Hi {{1}}, thank you for filling out our form! We see you are interested in {{2}}. Our team will reach out to you shortly. Feel free to message us here if you have any questions."}]',
  'draft', true, 'general', 'first_contact')

ON CONFLICT DO NOTHING;
