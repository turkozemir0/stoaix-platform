-- first_contact presetlerini tek parametre ({{1}} = ad) olarak güncelle
-- {{2}} kaldırıldı — sade, net mesaj

UPDATE public.message_templates SET components = '[{"type":"BODY","text":"Merhaba {{1}}, formumuzu doldurduğunuz için teşekkür ederiz! Sizinle iletişime geçmek istiyoruz. Sorularınız için buradan yazabilirsiniz."}]' WHERE is_preset = true AND purpose = 'first_contact' AND language = 'tr';

UPDATE public.message_templates SET components = '[{"type":"BODY","text":"Hi {{1}}, thank you for filling out our form! We would like to get in touch with you. Feel free to message us here with any questions."}]' WHERE is_preset = true AND purpose = 'first_contact' AND language = 'en';

UPDATE public.message_templates SET components = '[{"type":"BODY","text":"Hallo {{1}}, vielen Dank, dass Sie unser Formular ausgefuellt haben! Wir moechten uns gerne mit Ihnen in Verbindung setzen. Bei Fragen koennen Sie uns jederzeit hier schreiben."}]' WHERE is_preset = true AND purpose = 'first_contact' AND language = 'de';
