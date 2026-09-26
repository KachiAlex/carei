"""Generate the CAREi Infrastructure & AI Credits report as a .docx."""
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Base style
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

TEAL = RGBColor(0x0F, 0x1A, 0x2E)
ACCENT = RGBColor(0x1F, 0x6F, 0x6B)


def h(text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = TEAL
    return p


def para(text, bold=False, italic=False):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    return p


def bullets(items):
    for i in items:
        doc.add_paragraph(i, style='List Bullet')


def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 6'
    hdr = t.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = text
        for r in hdr[i].paragraphs[0].runs:
            r.bold = True
    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = text
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph()
    return t


# ─── Title ───
title = doc.add_heading('CAREi — Cloud Infrastructure & AI Credits Plan', level=0)
for run in title.runs:
    run.font.color.rgb = TEAL
sub = doc.add_paragraph()
r = sub.add_run('Implementation report — hosting, database, AI models, and account access')
r.italic = True
meta = doc.add_paragraph('26 September 2026')
meta.runs[0].font.color.rgb = RGBColor(0x66, 0x66, 0x66)

# ─── 1. Purpose ───
h('1. Purpose', 1)
para(
    'This report sets out the infrastructure plan for CAREi based on the Cloud and AI Credits Plan '
    '(23 Sep 2026). Two credit programmes fund the stack: Google for Startups ($2,000, expires '
    '1 Sep 2027) plus a Google Cloud free-trial balance (£225.63, expires 21 Nov 2026), and '
    'Microsoft for Startups ($5,000 in Azure, expires 19 May 2027). All care data is to be processed '
    'and stored in the UK: Google Cloud in London (europe-west2), Azure AI in UK South.'
)
para(
    'Guiding principle: every component draws on exactly one credit so nothing is billed twice, and '
    'no third-party AI model (Claude/Anthropic) is used anywhere — those calls bill the card, not credits.'
)

# ─── 2. Frontend Hosting ───
h('2. Frontend Hosting', 1)
para(
    'The frontend is a React + Vite + Capacitor application (PWA, iOS and Android). It is currently '
    'hosted on Vercel and will remain there.'
)
bullets([
    'No change required. The app already calls the backend via the absolute URL https://api.careiapp.com/api, '
    'so moving the backend does not require any frontend release — only a DNS change on the api subdomain.',
    'Vercel (or Firebase Hosting, as an equivalent static host) is acceptable under the plan; the credits '
    'plan only governs the backend, database, storage and AI services.',
])

# ─── 3. Backend & Database ───
h('3. Backend & Database Hosting', 1)

h('3.1 Option A — Google Cloud Run + Cloud SQL (credits plan)', 2)
para(
    'The credits plan places the backend on Cloud Run and the database on Cloud SQL for PostgreSQL, '
    'both in London (europe-west2), billed to Google credits.'
)
table(
    ['Component', 'Planned service', 'Region', 'Paid by'],
    [
        ['Backend API (Node + Express)', 'Cloud Run', 'London (europe-west2)', 'Google credits'],
        ['Database (care records, rotas, visits)', 'Cloud SQL for PostgreSQL', 'London (europe-west2)', 'Google credits'],
        ['Files (voice notes, exports, photos)', 'Cloud Storage', 'London (europe-west2)', 'Google credits'],
        ['API keys and passwords', 'Secret Manager', 'London (europe-west2)', 'Google credits (free at pilot size)'],
        ['Logs and error alerts', 'Cloud Logging & Monitoring', 'London (europe-west2)', 'Google credits'],
    ],
)
para('Work required to migrate:', bold=True)
bullets([
    'Containerise the API: extend the existing server/Dockerfile with a TypeScript build stage so the '
    'api/ handlers compile inside the image. server.js already reads the PORT environment variable, '
    'which Cloud Run sets automatically.',
    'Database driver: replace @neondatabase/serverless with pg plus @google-cloud/cloud-sql-connector. '
    'The ~60 handlers share one db module; a tagged-template adapter keeps their call sites unchanged.',
    'Data migration: pg_dump from Neon, pg_restore into Cloud SQL. The schema is plain PostgreSQL, '
    'so this is a clean export/restore.',
    'Secrets: DATABASE_URL and the Azure keys move into Google Secret Manager, mounted as environment '
    'variables on the Cloud Run service.',
    'Environments: carei-dev (sample data) and carei-prod (real client data) as separate GCP projects '
    'under billing account 01B71F-89A5AE-6D8F6A, per the plan.',
    'DNS: repoint api.careiapp.com (Cloudflare) to the Cloud Run domain mapping.',
])

h('3.2 Option B — UK VPS (recommended alternative)', 2)
para(
    'Owner recommendation: continue hosting the backend server and database on a VPS rather than '
    'moving to Cloud Run and Cloud SQL.'
)
bullets([
    'A UK-based VPS still satisfies the regional requirement — data remains processed and stored in the UK.',
    'It is more cost-effective for a predictable, always-on workload: a single VPS running the existing '
    'Express server and PostgreSQL is cheaper than equivalent always-on cloud instances, and the '
    'current deployment (nginx + PM2/Docker) already works this way.',
    'No migration effort: the existing server/ deployment scripts, Dockerfile and database remain as they are.',
])
para(
    'Consideration: VPS and Neon costs are paid in cash and are not covered by either credit programme. '
    'If Option B is chosen, the Google credits can still be applied to Maps/Geocoding (within the free '
    'allowance) and the AI spend remains covered by Azure credits. A hybrid is also possible: VPS for '
    'the API and database, Google Cloud only where it adds clear value (Secret Manager, Maps).',
    italic=True,
)

# ─── 4. AI ───
h('4. AI Models — Azure OpenAI, UK South', 1)
para(
    'All AI runs on Azure in UK South under the Microsoft for Startups credit. Deployments must use the '
    'Standard (regional) SKU — not Global or Data Zone — so prompts and care notes are processed in the '
    'UK. Two deployment tiers are recommended, optimised for lowest cost:'
)
table(
    ['Tier', 'Model', 'Cost (per 1M tokens)', 'Used for'],
    [
        ['Default (small)', 'gpt-4.1-nano', '$0.10 in / $0.40 out',
         'All high-volume jobs: voice-note structuring, copilot chat, tagging, summaries, family updates'],
        ['Quality (large)', 'gpt-4.1-mini', '$0.40 in / $1.60 out',
         'Care-plan drafts and compliance reports, where output quality is visible to families and inspectors'],
    ],
)
para(
    'gpt-5-nano is cheaper on paper ($0.05 in / $0.40 out) but regional availability for the newest '
    'models in UK South is limited and cannot be assumed — confirm in the Azure AI Foundry portal at '
    'deployment time and fall back to the 4.1 family, which also supports the parameters the current '
    'code uses (temperature, max_tokens). GPT-5 models additionally require max_completion_tokens and '
    'do not accept temperature, so the 4.1 family is the simpler port.'
)
para('Voice-to-text:', bold=True)
bullets([
    'Azure AI Speech (UK South) replaces the browser Web Speech API currently used for dictation. '
    'This keeps audio processing inside the UK residency story and works reliably in the native apps.',
    'Audio files move from base64 storage in Postgres to object storage, via a new transcription '
    'endpoint on the backend.',
])
para('Architecture and guardrails:', bold=True)
bullets([
    'Single AI module: all AI calls route through one backend module with prompts kept in one place. '
    'The current codebase calls the Anthropic API directly from seven files — each must be refactored '
    'to use the shared module. Model names are environment variables (e.g. AI_MODEL_SMALL / '
    'AI_MODEL_LARGE) so a future provider switch is a config change, not a code change.',
    'Microsoft models only in Foundry: Claude and other third-party models listed in Foundry are billed '
    'through Marketplace to the card — several startups have been billed $1,600–$3,000+ this way. '
    'Disable Marketplace purchases in Azure billing policy.',
    'Use structured outputs (JSON schema response format) for note structuring instead of parsing free text.',
    'After switching models, re-test handover and care-plan outputs with carers — a different model '
    'will word things differently.',
])

# ─── 5. Maps & Geocoding ───
h('5. Maps & Geocoding — Google Maps Platform', 1)
bullets([
    'Maps SDK for iOS and Android renders maps inside the native apps — free usage allowance, no limit '
    'under the current free tier.',
    'Geocoding API converts client addresses to coordinates — approximately 10,000 calls per month free '
    'per call type. This replaces the current Nominatim/OpenStreetMap geocoder, whose usage policy is '
    'not suited to production workloads.',
    'Geo-verification at clock-in remains on-device (GPS compared with the client\u2019s saved '
    'coordinates) — already implemented, no change needed.',
    'Key hygiene: restrict the API key to the CAREi bundle IDs and the Maps/Geocoding APIs only, and '
    'set a daily quota cap on Geocoding (e.g. 500/day) so a defect cannot run up card spend.',
])

# ─── 6. Access & Account Ownership ───
h('6. Access & Account Ownership', 1)
para('Access currently held:')
bullets([
    'Microsoft / Azure — CAREi account (nwokochalc@gmail.com, Microsoft for Startups subscription active)',
    'Apple Developer account',
    'Google Play Store developer account',
])
para('Access required:', bold=True)
bullets([
    'Google Cloud account (light@careiapp.com) — needed to set up the Maps and Geocoding APIs, and to '
    'configure the backend and database services if the Cloud Run option (3.1) is adopted.',
])
para(
    'Billing and credits remain with Light: light@careiapp.com for Google Cloud and '
    'nwokochalc@gmail.com for Azure. API keys are stored in Google Secret Manager (or the server\u2019s '
    'secret store if Option B is chosen) — never in chat, email, Replit or GitHub.',
    italic=True,
)

# ─── 7. Immediate actions ───
h('7. Immediate Actions', 1)
actions = [
    'Activate the Google Cloud paid billing account before 21 Nov 2026 — otherwise services pause when '
    'the trial ends and the $2,000 startup credit will not apply.',
    'Decide between Option A (Cloud Run + Cloud SQL) and Option B (UK VPS) for backend and database.',
    'Create the carei-dev (and later carei-prod) project(s); set budget alerts — £50/month dev, '
    '£150/month prod — noting budgets only alert, they do not cap spend.',
    'Create Azure OpenAI (two regional deployments) and Azure AI Speech resources in UK South; disable '
    'Marketplace purchases.',
    'Restrict the Google Maps key and set the Geocoding daily quota cap.',
    'Build the shared AI module and migrate the seven Anthropic call sites; add the Azure Speech '
    'transcription endpoint.',
    'Complete the security prerequisites (encryption at rest, app lock, remote wipe, DPIA sign-off) '
    'before real client data goes into production.',
]
for a in actions:
    doc.add_paragraph(a, style='List Number')

out = r'C:\carei\docs\CAREi-Infrastructure-and-AI-Plan.docx'
doc.save(out)
print('Saved:', out)
