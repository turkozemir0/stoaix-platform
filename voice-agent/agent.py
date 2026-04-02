"""
stoaix Platform Voice Agent — Multi-Tenant Inbound
LiveKit Cloud + Deepgram STT + GPT-4o Mini + Cartesia TTS

Her işletme aynı agent kodu — davranış DB config'inden gelir.

Room metadata:
  Inbound : {"organization_id": "uuid"}
            phone_from → SIP participant attribute 'sip.callFrom' ile okunur (room metadata'da değil)
  Outbound: {"organization_id": "uuid", "scenario": "followup", "contact_id": "...", "lead_id": "..."}
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Annotated
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AudioConfig,
    AutoSubscribe,
    BackgroundAudioPlayer,
    BuiltinAudioClip,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    llm,
)
from livekit.plugins import cartesia, deepgram, openai, silero

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stoaix-platform")


# ── Supabase client ────────────────────────────────────────────────────────────

def get_supabase():
    from supabase import create_client
    return create_client(
        os.environ["PLATFORM_SUPABASE_URL"],
        os.environ["PLATFORM_SUPABASE_SERVICE_KEY"],
    )


# ── DB yükleyiciler ────────────────────────────────────────────────────────────

async def load_org(org_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("organizations").select("*").eq("id", org_id).single().execute()
    if not res.data:
        raise ValueError(f"Organization not found: {org_id}")
    return res.data


async def load_playbook(org_id: str, channel: str = "voice") -> dict | None:
    sb = get_supabase()
    res = sb.table("agent_playbooks") \
        .select("*") \
        .eq("organization_id", org_id) \
        .eq("is_active", True) \
        .eq("channel", channel) \
        .order("version", desc=True) \
        .limit(1) \
        .execute()
    if res.data:
        return res.data[0]
    # channel-specific bulunamazsa "all" playbook'a düş
    res2 = sb.table("agent_playbooks") \
        .select("*") \
        .eq("organization_id", org_id) \
        .eq("is_active", True) \
        .eq("channel", "all") \
        .order("version", desc=True) \
        .limit(1) \
        .execute()
    return res2.data[0] if res2.data else None


async def load_intake_schema(org_id: str, channel: str = "voice") -> list:
    sb = get_supabase()
    res = sb.table("intake_schemas") \
        .select("fields") \
        .eq("organization_id", org_id) \
        .eq("is_active", True) \
        .eq("channel", channel) \
        .limit(1) \
        .execute()
    if res.data:
        return res.data[0].get("fields", [])
    # channel-specific bulunamazsa "all"'a düş
    res2 = sb.table("intake_schemas") \
        .select("fields") \
        .eq("organization_id", org_id) \
        .eq("is_active", True) \
        .eq("channel", "all") \
        .limit(1) \
        .execute()
    return res2.data[0].get("fields", []) if res2.data else []


# Ülke adı → KB tag eşlemesi (ülke ismi sorguda geçince tag filter uygula)
_COUNTRY_TAG_MAP = {
    "azerbaycan": "azerbaycan",
    "bosna":      "bosna_hersek",
    "kosova":     "kosova",
    "bulgaristan":"bulgaristan",
    "moldova":    "moldova",
    "romanya":    "romanya",
    "gürcistan":  "gurcistan",
    "sırbistan":  "sirbistan",
    "polonya":    "polonya",
    "iran":       "iran",
    "rusya":      "rusya",
    "makedonya":  "kuzey_makedonya",
}

def _detect_country_tag(text: str) -> str | None:
    """Metinde ülke ismi geçiyorsa ilgili KB tag'ini döner, yoksa None."""
    text_lower = text.lower()
    for keyword, tag in _COUNTRY_TAG_MAP.items():
        if keyword in text_lower:
            return tag
    return None


async def vector_search_kb(org_id: str, query: str, limit: int = 7) -> str:
    """Kullanıcının sorusuna en yakın KB itemlarını döndür.
    Sorguda ülke ismi varsa yalnızca o ülkenin item'larında arama yapar.
    """
    try:
        from openai import OpenAI as OpenAIClient
        oa = OpenAIClient(api_key=os.environ["OPENAI_API_KEY"])

        embed_resp = oa.embeddings.create(
            model="text-embedding-3-small",
            input=query,
            encoding_format="float"
        )
        query_vector = embed_resp.data[0].embedding
        vec_str = "[" + ",".join(str(x) for x in query_vector) + "]"

        country_tag = _detect_country_tag(query)
        sb = get_supabase()

        if country_tag:
            # Önce ülke filtreliyle dene
            res = sb.rpc("match_knowledge_items", {
                "org_id":       org_id,
                "query_vector": vec_str,
                "match_count":  limit * 3,
                "filter_tags":  [country_tag],
            }).execute()
            # Sonuç boşsa (bu org'da country tag yok) filtresiz tekrar dene
            if not res.data:
                res = sb.rpc("match_knowledge_items", {
                    "org_id":       org_id,
                    "query_vector": vec_str,
                    "match_count":  limit,
                }).execute()
        else:
            res = sb.rpc("match_knowledge_items", {
                "org_id":       org_id,
                "query_vector": vec_str,
                "match_count":  limit,
            }).execute()

        if not res.data:
            return ""

        chunks = []
        for item in res.data[:limit]:
            sim = item.get("similarity", 0)
            if sim < 0.25:
                continue
            chunks.append(f"[{item['title']}]\n{item['description_for_ai']}")

        return "\n\n---\n\n".join(chunks)

    except Exception as e:
        logger.warning(f"KB search failed: {e}")
        return ""


# ── Calendar API helpers ───────────────────────────────────────────────────────

async def fetch_free_slots_ghl(calendar_id: str, pit_token: str) -> str:
    """GHL free-slots API'sinden sonraki 3 günün müsait saatlerini çek."""
    import urllib.request
    try:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        start_date = now.strftime("%Y-%m-%d")
        end_date = (now + timedelta(days=3)).strftime("%Y-%m-%d")

        url = (
            f"https://services.leadconnectorhq.com/calendars/{calendar_id}/free-slots"
            f"?startDate={start_date}&endDate={end_date}&timezone=Europe%2FIstanbul"
        )
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {pit_token}",
            "Version": "2021-04-15",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())

        slots = data.get("slots", {})
        if not slots:
            return ""

        DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]
        lines = []
        for date, times in slots.items():
            if not times:
                continue
            d = datetime.strptime(date, "%Y-%m-%d")
            lines.append(f"{DAYS[d.weekday() + 1 if d.weekday() < 6 else 0]} ({date}): {', '.join(times[:5])}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"fetch_free_slots failed: {e}")
        return ""


async def create_appointment_ghl(
    calendar_id: str,
    pit_token: str,
    name: str,
    phone: str,
    datetime_str: str,
    notes: str = "",
) -> bool:
    """GHL'de randevu oluştur."""
    import urllib.request
    try:
        payload = json.dumps({
            "calendarId": calendar_id,
            "selectedTimezone": "Europe/Istanbul",
            "startTime": datetime_str,
            "title": f"Randevu — {name}",
            "appointmentStatus": "confirmed",
            "notes": notes,
            "contactName": name,
            "phone": phone,
        }).encode()
        req = urllib.request.Request(
            "https://services.leadconnectorhq.com/calendars/events/appointments",
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {pit_token}",
                "Version": "2021-04-15",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.warning(f"create_appointment failed: {e}")
        return False


# ── Prompt builder ─────────────────────────────────────────────────────────────

def build_system_prompt(
    org: dict,
    playbook: dict,
    intake_fields: list,
    kb_context: str,
    calendar_enabled: bool = False,
) -> str:
    persona      = org.get("ai_persona", {})
    persona_name = persona.get("persona_name", "Asistan")
    fallback_no_kb = persona.get("fallback_responses", {}).get(
        "no_kb_match",
        "Bu konuyu not aldım, danışmanımız sizi en kısa sürede arayacak."
    )
    tone = persona.get("tone", "warm-professional")
    tone_line = f"\nİletişim tonu: {tone}. Kısa, doğal, samimi cümleler kullan."

    few_shots = (playbook.get("few_shot_examples", []) or []) if playbook else []
    few_shot_text = ""
    if few_shots:
        examples = "\n".join(
            f'Kullanıcı: "{ex["user"]}"\nAsistan: "{ex["assistant"]}"'
            for ex in few_shots[:3]
        )
        few_shot_text = (
            "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"ÖRNEK DİYALOGLAR (konuşma tarzın için referans):\n{examples}"
        )

    calendar_section = (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "RANDEVU ALMA:\n"
        "Kullanıcı randevu, görüşme veya uygun saat talep ederse check_availability tool'unu çağır.\n"
        "Kullanıcı uygun bir saati seçince ad ve telefon al, ardından book_appointment tool'unu çağır.\n"
    ) if calendar_enabled else ""

    must_fields  = [f for f in intake_fields if f.get("priority") == "must"]
    must_prompts = "\n".join(
        f"- {f['label']}: \"{f.get('voice_prompt', f['label'])}\"" for f in must_fields
    )

    # routing_rules artık programatik olarak işleniyor — sistem promptuna gerek yok
    routing_text = ""

    blocks = playbook.get("hard_blocks", []) if playbook else []
    blocks_text = ""
    for b in blocks:
        kw = ", ".join(b.get("keywords", []))
        blocks_text += f"\n- [{b.get('trigger_id','')}] Anahtar kelimeler: {kw} → \"{b.get('response','')}\""

    triggers = playbook.get("handoff_triggers", {}) if playbook else {}
    handoff_keywords = ", ".join(triggers.get("keywords", []))

    base_prompt = playbook.get("system_prompt_template", "") if playbook else ""

    # TTS format kuralı + RAG — her zaman eklenir
    tts_and_rag = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KONUŞMA KURALLARI:
- Sayıları HER ZAMAN yazıyla söyle: "1500" yerine "bin beş yüz", "05321234567" yerine "sıfır beş üç iki bir iki üç dört beş altı yedi"
- Fiyatları yazıyla söyle: "2.500 TL" yerine "iki bin beş yüz lira"
- Tarihleri yazıyla söyle: "15.03.2026" yerine "on beş Mart iki bin yirmi altı"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BİLGİ TABANI (RAG — bu konuşma için ilgili içerik):
{kb_context if kb_context else "(Henüz sorgu yapılmadı — kullanıcı soru sorunca KB'den çekilecek)"}"""

    if base_prompt:
        # Custom prompt var — ton + tek-soru kuralı + TTS + RAG ekle, geri kalanlar template'de
        single_q = ""
        if must_prompts:
            single_q = (
                "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "VERİ TOPLAMA KURALI:\n"
                f"Zorunlu bilgiler (sırayla): {must_prompts}\n"
                "Kural: Aynı mesajda birden fazla soru sormak YASAK. Birer birer, doğal şekilde sor."
            )
        return f"{base_prompt}{tone_line}{single_q}{few_shot_text}{tts_and_rag}{calendar_section}"

    # Custom prompt YOK — generic org için tüm bölümleri ekle
    return f"""Sen {persona_name} adlı bir AI asistansın.
{tone_line}
{tts_and_rag}{few_shot_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPLANMASI GEREKEN BİLGİLER (zorunlu):
{must_prompts}

VERİ TOPLAMA TARZI:
- Bu bilgileri SORMADAN ÖNCE kullanıcının sorusunu cevapla.
- Bilgileri tek seferde sormak YASAK. Birer birer, doğal şekilde sor.
- Kullanıcı zaten paylaştıysa tekrar sorma.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAPSAM DIŞI KONULAR:{blocks_text if blocks_text else " (tanımlı blok yok)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HALÜSİNASYON KURALI:
{fallback_no_kb}
{calendar_section}"""


# ── Agent sınıfı ───────────────────────────────────────────────────────────────

class PlatformAgent(Agent):
    def __init__(self, instructions: str, org_id: str, lang: str = "tr", on_route_check=None):
        super().__init__(instructions=instructions)
        self.org_id               = org_id
        self.lang                 = lang
        self._kb_queried          = set()
        self._kb_empty_count      = 0
        self._ctx_country         = None   # konuşmada en son geçen ülke (query zenginleştirme için)
        # async callable(user_text, kb_was_empty) -> bool
        # True döndürürse routing gerçekleşti demek, LLM cevabı atlanır
        self._on_route_check = on_route_check

    async def on_user_turn_completed(self, turn_ctx, new_message):
        # Routing + KB injection — hata olsa bile super() mutlaka çağrılmalı
        try:
            user_text = ""
            if hasattr(new_message, "content"):
                c = new_message.content
                user_text = c if isinstance(c, str) else str(c)

            if user_text:
                # Konuşmada geçen ülkeyi takip et (bağlam zenginleştirme için)
                detected = _detect_country_tag(user_text)
                if detected:
                    self._ctx_country = detected

                # 1. Keyword/intent routing kontrolü — routing tetiklendiyse LLM atla
                if self._on_route_check:
                    was_routed = await self._on_route_check(user_text, False)
                    if was_routed:
                        return  # LLM cevabı üretme — routing kendi mesajını söyledi

                # 2. KB injection
                if user_text not in self._kb_queried:
                    self._kb_queried.add(user_text)
                    # Sorguda ülke geçmiyorsa ama daha önce bahsedilmişse query'ye ekle
                    # Örnek: "ne kadar?" → "ne kadar? kosova" → çok daha iyi similarity
                    kb_query = user_text
                    if self._ctx_country and self._ctx_country not in user_text.lower():
                        kb_query = f"{user_text} {self._ctx_country}"
                    kb_result = await vector_search_kb(self.org_id, kb_query)
                    if kb_result:
                        self._kb_empty_count = 0
                        # Kullanıcı fiyat sormadıysa KB içeriğindeki fiyat bilgilerini kullanma
                        _price_kws = ["fiyat", "ücret", "kaç para", "ne kadar", "maliyet", "para", "euro", "dolar", "tl ", "tutar"]
                        _user_asks_price = any(kw in user_text.lower() for kw in _price_kws)
                        _price_note = "" if _user_asks_price else "\nÖNEMLİ: Kullanıcı fiyat/ücret sormadı — aşağıdaki içerikteki FİYAT ve ÜCRET bilgilerini KULLANMA."
                        msg_content = f"[KB Bağlamı — Bu soruyla ilgili bilgi tabanı içeriği:]{_price_note}\n{kb_result}"
                        try:
                            turn_ctx.messages.append(
                                llm.ChatMessage(role="system", content=msg_content)
                            )
                        except (AttributeError, TypeError):
                            turn_ctx.add_message(role="system", content=msg_content)
                    elif self._on_route_check:
                        # KB boş geldi — 2. ardışık boşta kb_fallback tetikle
                        self._kb_empty_count += 1
                        if self._kb_empty_count >= 2:
                            was_routed = await self._on_route_check(user_text, True)
                            if was_routed:
                                return  # LLM cevabı üretme
        except Exception as e:
            logger.warning(f"on_user_turn_completed error (non-fatal): {e}")

        # Base class — LLM response'u tetikler (1.5.x'te zorunlu)
        await super().on_user_turn_completed(turn_ctx, new_message)


# ── DB yazıcılar ───────────────────────────────────────────────────────────────

async def create_conversation(
    org_id: str,
    contact_id: str | None,
    lead_id: str | None,
    room_name: str,
) -> str | None:
    """Çağrı başında conversations kaydı aç."""
    try:
        sb = get_supabase()
        res = sb.table("conversations").insert({
            "organization_id": org_id,
            "contact_id":      contact_id,
            "lead_id":         lead_id,
            "channel":         "voice",
            "status":          "active",
            "channel_metadata": {"livekit_room": room_name},
        }).execute()
        conv_id = res.data[0]["id"] if res.data else None
        logger.info(f"conversation created: {conv_id}")
        return conv_id
    except Exception as e:
        logger.warning(f"conversation create failed: {e}")
        return None


async def close_conversation(conv_id: str):
    try:
        sb = get_supabase()
        sb.table("conversations").update({
            "status":   "closed",
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", conv_id).execute()
    except Exception as e:
        logger.warning(f"conversation close failed: {e}")


async def save_messages(conv_id: str, org_id: str, transcript: list):
    """Transcript'i messages tablosuna yaz."""
    if not conv_id or not transcript:
        return
    try:
        sb = get_supabase()
        rows = [
            {
                "conversation_id": conv_id,
                "organization_id": org_id,
                "role":            m["role"],
                "content":         m["content"],
                "content_type":    "audio_transcript",
            }
            for m in transcript
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        if rows:
            sb.table("messages").insert(rows).execute()
            logger.info(f"messages saved: {len(rows)} rows")
    except Exception as e:
        logger.warning(f"messages save failed: {e}")


async def extract_collected_data(transcript: list, intake_fields: list) -> dict:
    """LLM ile transcript'ten structured data çıkar."""
    if not transcript or not intake_fields:
        return {}
    try:
        from openai import OpenAI as OpenAIClient
        oa = OpenAIClient(api_key=os.environ["OPENAI_API_KEY"])

        field_defs = "\n".join(
            f"- {f['key']} ({f['label']}): {f.get('type', 'text')}"
            for f in intake_fields
        )
        transcript_text = "\n".join(
            f"[{m['role']}] {m['content']}"
            for m in transcript
            if m.get("role") in ("user", "assistant")
        )

        prompt = f"""Aşağıdaki sesli görüşme transkripsiyonundan şu bilgileri çıkar ve JSON formatında döndür.
Her field için YALNIZCA kullanıcının açıkça söylediği değeri yaz. Söylemediyse null koy.

ÖNEMLI KURALLAR:
- "nationality" (uyruk): Kullanıcının hangi ülkede okumak istediğinden DEĞİL, bizzat söylediği uyruğundan çıkar. Söylemediyse null.
- "city": Kullanıcının aradığı Türkiye'deki şehir, hedef ülkedeki şehir değil.
- Çıkarım veya tahmin YAPMA — sadece kullanıcının açıkça belirttiği bilgileri yaz.

Toplanacak bilgiler:
{field_defs}

Konuşma:
{transcript_text[:6000]}

Sadece JSON döndür. Örnek: {{"full_name": "Ali Veli", "phone": null, "budget": "50000"}}"""

        resp = oa.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=500,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.warning(f"collected_data extraction failed: {e}")
        return {}


INTENT_KEYWORDS = [
    "randevu", "ne zaman gelebilirim", "ne zaman başlayabiliriz", "ne zaman gelsem",
    "fiyat alabilir miyim", "teklif alabilir miyim", "teklif ver", "sipariş",
    "başlamak istiyorum", "almak istiyorum", "satın almak", "satın almak istiyorum",
    "görüşmek istiyorum", "geri arayın", "geri arar mısınız", "ara beni", "beni arayın",
    "rezervasyon", "ayarlayabilir misiniz", "müsait misiniz", "ne zaman başlar",
]

def calculate_qualification_score(intake_fields: list, collected_data: dict, transcript: list = None) -> int:
    """Toplanan veri doluluk oranına + niyet/etkileşim sinyallerine göre 0-100 skor hesapla."""
    if not intake_fields or not collected_data:
        return 0

    must_fields   = [f["key"] for f in intake_fields if f.get("priority") == "must"]
    should_fields = [f["key"] for f in intake_fields if f.get("priority") == "should"]

    if not must_fields:
        return 0

    must_collected   = sum(1 for k in must_fields   if collected_data.get(k))
    should_collected = sum(1 for k in should_fields if collected_data.get(k))

    must_score   = (must_collected   / len(must_fields))   * 70 if must_fields   else 0
    should_score = (should_collected / len(should_fields)) * 30 if should_fields else 0
    base = round(must_score + should_score)

    if transcript:
        user_texts = " ".join(
            t.get("content", "") for t in transcript if t.get("role") == "user"
        ).lower()

        # Niyet bonusu +12: satın alma / randevu niyeti sinyali
        if any(kw in user_texts for kw in INTENT_KEYWORDS):
            base += 12

        # Etkileşim bonusu +5: 3+ kullanıcı turu olan aktif konuşma
        user_turns = sum(1 for t in transcript if t.get("role") == "user")
        if user_turns >= 3:
            base += 5

    return min(100, base)


async def generate_call_summary(transcript: list, collected_data: dict, org_name: str) -> str:
    """GPT-4o mini ile konuşmanın kısa AI özetini üret."""
    if not transcript:
        return ""
    try:
        from openai import OpenAI as OpenAIClient
        oa = OpenAIClient(api_key=os.environ["OPENAI_API_KEY"])

        transcript_text = "\n".join(
            f"[{m['role']}] {m['content']}"
            for m in transcript
            if m.get("role") in ("user", "assistant")
        )
        data_str = ", ".join(f"{k}: {v}" for k, v in collected_data.items() if v)

        prompt = f"""Aşağıdaki sesli görüşmeyi 2-3 cümleyle özetle. Türkçe yaz.
Müşterinin ilgilendiği konu, temel bilgileri ve sonraki adım varsa belirt.
Toplanan veriler: {data_str or 'yok'}

Konuşma:
{transcript_text[:3000]}

Özet:"""

        resp = oa.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"summary generation failed: {e}")
        return ""


async def update_lead_data(lead_id: str, intake_fields: list, collected_data: dict, summary: str = "", transcript: list = None):
    """collected_data, data_completeness, missing_fields, score ve özet güncelle."""
    if not lead_id:
        return
    try:
        must_keys = {f["key"] for f in intake_fields if f.get("priority") == "must"}

        completeness = {
            f["key"]: ("collected" if collected_data.get(f["key"]) else "not_collected")
            for f in intake_fields
        }
        missing = [k for k in must_keys if not collected_data.get(k)]
        score   = calculate_qualification_score(intake_fields, collected_data, transcript)

        update_payload = {
            "collected_data":      collected_data,
            "data_completeness":   completeness,
            "missing_fields":      missing,
            "qualification_score": score,
            "status":              "in_progress" if collected_data else "new",
        }
        if summary:
            update_payload["ai_summary"] = summary

        sb = get_supabase()
        sb.table("leads").update(update_payload).eq("id", lead_id).execute()
        logger.info(f"lead updated — score: {score}, missing: {missing}")
    except Exception as e:
        logger.warning(f"lead data update failed: {e}")


async def save_handoff(
    org_id:         str,
    lead_id:        str | None,
    conv_id:        str | None,
    trigger_reason: str,
    summary:        str,
    collected_data: dict,
    missing_fields: list,
):
    """Handoff log oluştur ve lead'i güncelle."""
    try:
        sb = get_supabase()
        sb.table("handoff_logs").insert({
            "organization_id":         org_id,
            "lead_id":                 lead_id,
            "conversation_id":         conv_id,
            "trigger_reason":          trigger_reason,
            "summary":                 summary,
            "collected_data_snapshot": collected_data,
            "missing_at_handoff":      missing_fields,
            "status":                  "pending",
        }).execute()

        if lead_id:
            sb.table("leads").update({
                "status":            "handed_off",
                "handoff_triggered": True,
                "handoff_at":        datetime.now(timezone.utc).isoformat(),
                "handoff_summary":   summary,
            }).eq("id", lead_id).execute()

        logger.info(f"handoff_log saved — reason: {trigger_reason}")
    except Exception as e:
        logger.warning(f"handoff save failed: {e}")


async def save_call(
    org_id:          str,
    direction:       str,
    call_start:      datetime,
    duration:        int,
    transcript:      list,
    phone_from:      str = "",
    phone_to:        str = "",
    contact_id:      str | None = None,
    lead_id:         str | None = None,
    conversation_id: str | None = None,
    metadata:        dict | None = None,
):
    try:
        sb = get_supabase()
        transcript_text = "\n".join(
            f"[{m.get('role','?')}] {m.get('content','')}"
            for m in transcript
        )
        sb.table("voice_calls").insert({
            "organization_id": org_id,
            "contact_id":      contact_id,
            "conversation_id": conversation_id,
            "lead_id":         lead_id,
            "direction":       direction,
            "status":          "completed",
            "phone_from":      phone_from,
            "phone_to":        phone_to,
            "duration_seconds": duration,
            "transcript":      transcript_text,
            "livekit_room_name": (metadata or {}).get("livekit_room"),
            "started_at":      call_start.replace(tzinfo=timezone.utc).isoformat(),
            "ended_at":        datetime.now(timezone.utc).isoformat(),
            **({"metadata": metadata} if metadata else {}),
        }).execute()
        logger.info(f"voice_call saved — {direction}, {duration}s")
    except Exception as e:
        logger.warning(f"voice_call save failed: {e}")


async def upsert_contact_and_lead(
    org_id:     str,
    phone_from: str,
    org_name:   str,
    source:     str = "voice_inbound",
) -> tuple[str | None, str | None]:
    try:
        sb = get_supabase()
        contact_id = None
        lead_id    = None

        if phone_from:
            existing = sb.table("contacts") \
                .select("id") \
                .eq("organization_id", org_id) \
                .eq("phone", phone_from) \
                .limit(1) \
                .execute()

            if existing.data:
                contact_id = existing.data[0]["id"]
            else:
                res = sb.table("contacts").insert({
                    "organization_id": org_id,
                    "phone":           phone_from,
                    "status":          "new",
                    "source_channel":  source,
                }).execute()
                if res.data:
                    contact_id = res.data[0]["id"]
        else:
            # Caller number unavailable — create anonymous contact so conversation insert doesn't fail
            res = sb.table("contacts").insert({
                "organization_id": org_id,
                "status":          "anonymous",
                "source_channel":  source,
            }).execute()
            if res.data:
                contact_id = res.data[0]["id"]

        if contact_id:
            open_lead = sb.table("leads") \
                .select("id") \
                .eq("organization_id", org_id) \
                .eq("contact_id", contact_id) \
                .in_("status", ["new", "in_progress"]) \
                .limit(1) \
                .execute()

            if open_lead.data:
                lead_id = open_lead.data[0]["id"]
            else:
                res = sb.table("leads").insert({
                    "organization_id": org_id,
                    "contact_id":      contact_id,
                    "status":          "new",
                    "source_channel":  source,
                    "collected_data":  {},
                    "data_completeness": {},
                    "missing_fields":  [],
                }).execute()
                if res.data:
                    lead_id = res.data[0]["id"]

        return contact_id, lead_id

    except Exception as e:
        logger.warning(f"contact/lead upsert failed: {e}")
        return None, None


# ── Routing yardımcıları ───────────────────────────────────────────────────────

def is_business_hours(working_hours: dict) -> bool:
    """Şu anki zamanın mesai saatlerinde olup olmadığını kontrol eder."""
    tz = ZoneInfo(working_hours.get("timezone", "Europe/Istanbul"))
    now = datetime.now(tz)
    weekday = now.weekday()  # 0=Pzt, 5=Cmt, 6=Paz

    if weekday < 5:
        hours_str = working_hours.get("weekdays")
    elif weekday == 5:
        hours_str = working_hours.get("saturday")
    else:
        hours_str = working_hours.get("sunday")

    if not hours_str:
        return False
    start, end = hours_str.split("-")
    sh, sm = map(int, start.split(":"))
    eh, em = map(int, end.split(":"))
    start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
    end_dt   = now.replace(hour=eh, minute=em, second=0, microsecond=0)
    return start_dt <= now <= end_dt


async def do_sip_transfer(room_name: str, participant_identity: str, to_number: str):
    """02122446600 formatındaki numarayı tel:+902122446600 olarak SIP transfer et."""
    from livekit import api as lk_api
    digits    = to_number.lstrip("0")
    transfer_to = f"tel:+90{digits}"
    lk = lk_api.LiveKitAPI(
        os.environ.get("LIVEKIT_URL"),
        os.environ.get("LIVEKIT_API_KEY"),
        os.environ.get("LIVEKIT_API_SECRET"),
    )
    try:
        await lk.sip.transfer_sip_participant(
            lk_api.TransferSIPParticipantRequest(
                room_name=room_name,
                participant_identity=participant_identity,
                transfer_to=transfer_to,
                play_dialtone=True,
            )
        )
        logger.info(f"SIP transfer → {transfer_to}")
    finally:
        await lk.aclose()


async def evaluate_routing(user_text: str, kb_was_empty: bool, rules: list) -> dict | None:
    """
    Eşleşen ilk routing kuralını döner (priority sırasına göre sıralı bekler).
    kb_was_empty=True ise kb_fallback kuralı da değerlendirilir.
    Eşleşme yoksa None döner.
    """
    text_lower = user_text.lower()
    for rule in rules:
        if not rule.get("active"):
            continue
        rule_type = rule.get("type", "")

        if rule_type == "kb_fallback" and kb_was_empty:
            return rule

        if rule_type in ("intent", "topic_note", "sentiment_note"):
            for kw in rule.get("keywords", []):
                if kw.lower() in text_lower:
                    return rule
    return None


async def create_follow_up_task(
    org_id: str,
    lead_id: str | None,
    contact_id: str | None,
    rule_id: str,
    note_text: str,
):
    """Geri arama görevi oluştur (voice_callback)."""
    from datetime import timedelta
    try:
        scheduled = datetime.now(ZoneInfo("Europe/Istanbul")) + timedelta(hours=1)
        sb = get_supabase()
        sb.table("follow_up_tasks").insert({
            "organization_id": org_id,
            "lead_id":         lead_id,
            "contact_id":      contact_id,
            "task_type":       "voice_callback",
            "scheduled_at":    scheduled.isoformat(),
            "status":          "pending",
            "variables":       {"rule_triggered": rule_id, "caller_note": note_text},
        }).execute()
        logger.info(f"follow_up_task created — rule: {rule_id}")
    except Exception as e:
        logger.warning(f"follow_up_task create failed: {e}")


async def handle_routing(
    rule: dict,
    working_hours: dict,
    transfer_numbers: dict,
    room_name: str,
    participant_identity: str,
    org_id: str,
    lead_id: str | None,
    contact_id: str | None,
    user_text: str,
    agent_session,
):
    """Routing kuralını işle: Tier 1 → transfer veya callback vaadi; Tier 2 → not al."""
    within_hours = is_business_hours(working_hours)
    tier = rule.get("tier", 2)

    if tier == 1 and within_hours:
        msg = rule.get("transition_message", "Sizi aktarıyorum, lütfen bekleyin.")
        await agent_session.say(msg, allow_interruptions=False)
        primary_number = transfer_numbers.get("primary", "")
        if primary_number and participant_identity:
            await do_sip_transfer(room_name, participant_identity, primary_number)
        await save_handoff(org_id, lead_id, None, "routing", f"Rule: {rule['id']}", {}, [])
    else:
        if tier == 1:
            msg = rule.get("after_hours_message", "Mesai saatlerimiz dışındayız, sizi arayacağız.")
        else:
            msg = rule.get("note_message", "Notunuzu aldım, danışmanımız sizi arayacak.")
        await agent_session.say(msg, allow_interruptions=False)
        await create_follow_up_task(org_id, lead_id, contact_id, rule["id"], user_text)


# ── SIP yardımcıları ───────────────────────────────────────────────────────────

def _get_sip_caller_number(ctx: JobContext) -> str:
    """
    Inbound SIP aramasında arayan numarasını LiveKit participant attribute'larından okur.
    LiveKit, SIP katılımcısına otomatik olarak 'sip.callFrom' attribute'u set eder.
    Room metadata'daki 'phone_from' (dispatch rule'da statik) yerine bu kullanılmalı.
    """
    for participant in ctx.room.remote_participants.values():
        attrs = participant.attributes or {}
        call_from = attrs.get("sip.callFrom", "")
        if call_from:
            return call_from if call_from.startswith("+") else "+" + call_from
    return ""


def _get_sip_participant_identity(ctx: JobContext) -> str:
    """SIP katılımcısının LiveKit identity'sini döndür (transfer için gerekli)."""
    for participant in ctx.room.remote_participants.values():
        attrs = participant.attributes or {}
        if attrs.get("sip.callFrom") or attrs.get("sip.callTo"):
            return participant.identity
    return ""


# ── Entrypoint ─────────────────────────────────────────────────────────────────

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    try:
        meta = json.loads(ctx.room.metadata or "{}")
    except json.JSONDecodeError:
        meta = {}

    # Dispatch (job) metadata'sına da bak — test token'larında room metadata boş gelir
    if not meta.get("organization_id"):
        try:
            job_meta = json.loads(ctx.job.metadata or "{}")
            meta = {**job_meta, **meta}
        except (json.JSONDecodeError, AttributeError):
            pass

    org_id   = meta.get("organization_id") or os.environ.get("PLATFORM_ORG_ID")
    scenario = meta.get("scenario")

    if not org_id:
        raise ValueError("organization_id missing in room metadata and PLATFORM_ORG_ID env not set")

    org      = await load_org(org_id)
    playbook = await load_playbook(org_id, channel="voice")
    intake   = await load_intake_schema(org_id, channel="voice")

    persona      = org.get("ai_persona", {})
    persona_name = persona.get("persona_name", "Asistan")
    lang         = meta.get("lang") or persona.get("language", "tr")
    room_name    = ctx.room.name

    # Routing config yükle
    routing_cfg        = (playbook or {}).get("routing_rules", {}) if playbook else {}
    transfer_numbers   = routing_cfg.get("transfer_numbers", {})
    routing_rules_list = sorted(
        routing_cfg.get("rules", []),
        key=lambda r: r.get("priority", 99),
    )
    working_hours_cfg  = org.get("working_hours", {})

    # Features (playbook) + channel config (admin) — her ikisinden de oku
    features         = (playbook or {}).get("features", {}) if playbook else {}
    calendar_enabled = features.get("calendar_booking", False)
    crm_config       = org.get("crm_config", {})
    calendar_id      = crm_config.get("calendar_id", "")
    pit_token        = crm_config.get("pit_token", "")
    if not (calendar_id and pit_token):
        calendar_enabled = False

    # Voice dil + ses ID: playbook features > channel_config.voice_inbound > ai_persona.language
    vi_cfg           = org.get("channel_config", {}).get("voice_inbound", {})
    voice_lang_cfg   = features.get("voice_language") or vi_cfg.get("voice_language")
    tts_voice_id_cfg = features.get("tts_voice_id")  or vi_cfg.get("tts_voice_id")
    if voice_lang_cfg:
        lang = voice_lang_cfg

    logger.info(f"{'Outbound' if scenario else 'Inbound'} — org: {org['name']} | lang: {lang} | scenario: {scenario}")

    # Handoff keyword listesi (runtime'da kontrol için)
    handoff_keywords = []
    if playbook:
        handoff_keywords = playbook.get("handoff_triggers", {}).get("keywords", [])

    # ── İnbound ───────────────────────────────────────────────────────────────
    if not scenario:
        kb_genel   = await vector_search_kb(org_id, "genel bilgi hizmetler ülkeler programlar")
        kb_ofisler = await vector_search_kb(org_id, "temsilcilik ofis şube iletişim telefon")
        initial_kb = kb_genel + "\n\n" + kb_ofisler if kb_ofisler else kb_genel
        system_prompt = build_system_prompt(org, playbook, intake, initial_kb, calendar_enabled)
        opening    = (
            playbook.get("opening_message")
            if playbook and playbook.get("opening_message")
            else f"Merhaba! {org['name']}'ı aradınız, ben {persona_name}. Hangi ilden arıyorsunuz?"
        )
        direction  = "inbound"
        phone_from = _get_sip_caller_number(ctx) or meta.get("phone_from", "")
        phone_to   = os.environ.get("PLATFORM_INBOUND_NUMBER", "")

        contact_id, lead_id = await upsert_contact_and_lead(
            org_id, phone_from, org["name"], source="voice_inbound"
        )

    # ── Outbound ──────────────────────────────────────────────────────────────
    else:
        contact_name = meta.get("contact_name", "")
        phone_to     = meta.get("phone_to", "")
        lead_id      = meta.get("lead_id") or None
        contact_id   = meta.get("contact_id") or None
        context_note = meta.get("context_note", "")

        # If contact_id wasn't passed in metadata, upsert from phone_to so conversation insert never fails
        if not contact_id:
            contact_id, fallback_lead_id = await upsert_contact_and_lead(
                org_id, phone_to, org["name"], source="voice_outbound"
            )
            if not lead_id:
                lead_id = fallback_lead_id

        outbound_playbook_text = playbook.get("system_prompt_template", "") if playbook else ""
        system_prompt = f"""{outbound_playbook_text}

Sen {org['name']} adına arayan {persona_name}'sın.
Arama yapılan kişi: {contact_name}
Arama amacı: {scenario}
{f"Bağlam notu: {context_note}" if context_note else ""}

KURAL: Kısa ve doğal konuş. Zorlayıcı olma.
KURAL: Bilgi tabanında olmayan bir şeyi asla uydurma.
"""
        opening = (
            f"Merhaba{', ' + contact_name if contact_name else ''}! "
            f"Ben {org['name']}'dan {persona_name} arıyorum. "
            f"Şu an uygun musunuz, iki dakikanız var mı?"
        )
        direction  = "outbound"
        phone_from = os.environ.get("PLATFORM_OUTBOUND_NUMBER", "")

    # ── Conversation aç ───────────────────────────────────────────────────────
    conv_id = await create_conversation(org_id, contact_id, lead_id, room_name)

    # ── Calendar tools (only if feature enabled) ───────────────────────────────
    fnc_ctx = None
    if calendar_enabled:
        fnc_ctx = llm.FunctionContext()

        @fnc_ctx.ai_callable(description="Müsait randevu saatlerini listeler. Kullanıcı randevu/görüşme istediğinde çağır.")
        async def check_availability(
            date: Annotated[str, llm.TypeInfo(description="Kontrol edilecek tarih, YYYY-MM-DD formatında. Belirtilmezse yakın 3 günü döndür.")] = ""
        ) -> str:
            slots = await fetch_free_slots_ghl(calendar_id, pit_token)
            if not slots:
                return "TAKVİM_HATA: Takvime şu an erişemiyorum. Kullanıcıya ekibimizin en kısa sürede kendisini arayacağını söyle ve görüşmeyi nazikçe sonlandır."
            return f"Müsait saatler:\n{slots}"

        @fnc_ctx.ai_callable(description="Randevu oluşturur. Kullanıcı ad, telefon ve saat bilgisini verdikten sonra çağır.")
        async def book_appointment(
            name: Annotated[str, llm.TypeInfo(description="Randevu sahibinin adı soyadı")],
            phone: Annotated[str, llm.TypeInfo(description="Telefon numarası, +90 ile başlayan format")],
            datetime_str: Annotated[str, llm.TypeInfo(description="Randevu tarihi ve saati, YYYY-MM-DDTHH:MM formatında")],
            notes: Annotated[str, llm.TypeInfo(description="Ek notlar veya özel istekler")] = "",
        ) -> str:
            ok = await create_appointment_ghl(calendar_id, pit_token, name, phone, datetime_str, notes)
            if ok:
                return f"Randevunuz oluşturuldu: {name}, {datetime_str}. Onay bilgisi size iletilecektir."
            return "Randevu oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin veya bizi arayın."

    # ── Session ───────────────────────────────────────────────────────────────
    VOICE_IDS = {
        "tr": os.environ.get("CARTESIA_VOICE_ID_TR", "c1cfee3d-532d-47f8-8dd2-8e5b2b66bf1d"),
        "en": os.environ.get("CARTESIA_VOICE_ID_EN", "b7d50908-b17c-442d-ad8d-810c63997ed9"),
        "de": os.environ.get("CARTESIA_VOICE_ID_DE", ""),
        "fr": os.environ.get("CARTESIA_VOICE_ID_FR", ""),
        "es": os.environ.get("CARTESIA_VOICE_ID_ES", ""),
        "ar": os.environ.get("CARTESIA_VOICE_ID_AR", ""),
        "nl": os.environ.get("CARTESIA_VOICE_ID_NL", ""),
        "it": os.environ.get("CARTESIA_VOICE_ID_IT", ""),
        "pt": os.environ.get("CARTESIA_VOICE_ID_PT", ""),
        "pl": os.environ.get("CARTESIA_VOICE_ID_PL", ""),
    }
    # Dil kodu normalize: "de-DE" → "de"
    lang_code = lang.split("-")[0].lower() if lang else "tr"
    tts_lang  = lang_code if lang_code in VOICE_IDS else "tr"

    # Ses ID: önce config'den gelen override, yoksa VOICE_IDS dict, yoksa TR default
    effective_voice_id = (
        tts_voice_id_cfg
        or VOICE_IDS.get(tts_lang)
        or VOICE_IDS["tr"]
    )

    logger.info(f"Voice config — lang: {tts_lang} | voice_id: {effective_voice_id[:12] if effective_voice_id else 'default'}...")

    session = AgentSession(
        stt=deepgram.STT(model="nova-2", language=tts_lang),
        llm=openai.LLM(model="gpt-4o-mini", temperature=0.4),
        tts=cartesia.TTS(
            model="sonic-3",
            voice=effective_voice_id,
            language=tts_lang,
        ),
        vad=silero.VAD.load(),
        **({"fnc_ctx": fnc_ctx} if fnc_ctx else {}),
    )

    call_start        = datetime.utcnow()
    transcript        = []
    handoff_reason    = None   # handoff tetiklendiyse sebebi
    routing_triggered = False  # routing kuralı tetiklendiyse True

    async def _check_and_route(user_text: str, kb_was_empty: bool = False) -> bool:
        """Routing kuralını değerlendir. True → routing tetiklendi (LLM cevabı atlanmalı)."""
        nonlocal routing_triggered
        if routing_triggered or not routing_rules_list:
            return False
        rule = await evaluate_routing(user_text, kb_was_empty, routing_rules_list)
        if rule:
            routing_triggered = True
            logger.info(f"Routing rule triggered: {rule['id']} (kb_empty={kb_was_empty})")
            participant_identity = _get_sip_participant_identity(ctx)
            await handle_routing(
                rule=rule,
                working_hours=working_hours_cfg,
                transfer_numbers=transfer_numbers,
                room_name=room_name,
                participant_identity=participant_identity,
                org_id=org_id,
                lead_id=lead_id,
                contact_id=contact_id,
                user_text=user_text,
                agent_session=session,
            )
            return True
        return False

    @session.on("conversation_item_added")
    def on_item(ev):
        nonlocal handoff_reason
        item    = ev.item
        role    = getattr(item, "role", None)
        content = getattr(item, "content", None)
        if role and content:
            text = content if isinstance(content, str) else str(content)
            transcript.append({"role": role, "content": text})

            if role == "user":
                # Handoff keyword kontrolü (routing dışı — sadece log için)
                if handoff_keywords and handoff_reason is None:
                    text_lower = text.lower()
                    for kw in handoff_keywords:
                        if kw.lower() in text_lower:
                            handoff_reason = "user_requested"
                            logger.info(f"Handoff triggered by keyword: {kw}")
                            break
                # NOT: routing kontrolü artık on_user_turn_completed içinde (await, LLM öncesi)

    background_audio = BackgroundAudioPlayer(
        ambient_sound=AudioConfig(BuiltinAudioClip.OFFICE_AMBIENCE, volume=0.15),
        thinking_sound=AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.5),
    )

    await session.start(
        agent=PlatformAgent(
            instructions=system_prompt,
            org_id=org_id,
            lang=tts_lang,
            on_route_check=_check_and_route if routing_rules_list else None,
        ),
        room=ctx.room,
        room_input_options=RoomInputOptions(noise_cancellation=True),
    )

    await background_audio.start(room=ctx.room, agent_session=session)

    # Opening mesajı: LLM'e ekstra talimat vererek verbatim söylenmesini sağla
    await session.generate_reply(
        instructions=f"AÇILIŞ MESAJIN: Bu metni KELIMESI KELIMESINE söyle, hiçbir şey ekleme, hiçbir soru sorma: «{opening}»"
    )

    MAX_CALL_SECONDS = 1800  # 30 dakika hard limit

    # Room "disconnected" event'ini bekle — CancelledError sorunu olmaz
    room_disconnected = asyncio.Event()
    ctx.room.on("disconnected", lambda: room_disconnected.set())

    try:
        await asyncio.wait_for(room_disconnected.wait(), timeout=MAX_CALL_SECONDS)
    except asyncio.TimeoutError:
        logger.warning(f"Max call duration ({MAX_CALL_SECONDS}s) reached — ending session")
        await session.aclose()
    finally:
        await _save_all(
            org_id=org_id,
            direction=direction,
            call_start=call_start,
            transcript=transcript,
            phone_from=phone_from,
            phone_to=phone_to,
            contact_id=contact_id,
            lead_id=lead_id,
            conv_id=conv_id,
            intake=intake,
            handoff_reason=handoff_reason,
            room_name=room_name,
        )


async def _save_all(
    org_id, direction, call_start, transcript,
    phone_from, phone_to, contact_id, lead_id,
    conv_id, intake, handoff_reason, room_name,
):
    """Çağrı bittikten sonra tüm DB yazımlarını sırayla yap."""
    duration = int((datetime.utcnow() - call_start).total_seconds())

    # 1. Messages
    await save_messages(conv_id, org_id, transcript)

    # 2. Collected data çıkar, AI özet üret, lead güncelle
    collected_data = {}
    missing_fields = []
    summary        = ""
    if lead_id and intake:
        collected_data = await extract_collected_data(transcript, intake)
        summary        = await generate_call_summary(transcript, collected_data, org_id)
        await update_lead_data(lead_id, intake, collected_data, summary, transcript)
        must_keys      = {f["key"] for f in intake if f.get("priority") == "must"}
        missing_fields = [k for k in must_keys if not collected_data.get(k)]

    # 3. Handoff log
    if handoff_reason:
        summary = f"Handoff tetiklendi ({handoff_reason}). Konuşma süresi: {duration}s."
        await save_handoff(
            org_id=org_id,
            lead_id=lead_id,
            conv_id=conv_id,
            trigger_reason=handoff_reason,
            summary=summary,
            collected_data=collected_data,
            missing_fields=missing_fields,
        )
        if conv_id:
            get_supabase().table("conversations").update({"status": "handed_off"}).eq("id", conv_id).execute()
    else:
        # 4. Conversation kapat
        if conv_id:
            await close_conversation(conv_id)

    # 5. Voice call kaydet
    await save_call(
        org_id=org_id,
        direction=direction,
        call_start=call_start,
        duration=duration,
        transcript=transcript,
        phone_from=phone_from,
        phone_to=phone_to,
        contact_id=contact_id,
        lead_id=lead_id,
        conversation_id=conv_id,
        metadata={"livekit_room": room_name},
    )

    logger.info(f"All data saved — duration: {duration}s, handoff: {handoff_reason}")


# ── Başlat ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="stoaix-platform",
    ))
