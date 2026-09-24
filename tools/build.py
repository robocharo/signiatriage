#!/usr/bin/env python3
"""
Signia Solutions — static site builder.

Why this exists: the site ships as plain HTML with no runtime dependencies, but
the header, footer, icon sprite and SEO scaffolding must be byte-identical on
every page. Hand-copying them is how nav links and schema drift apart. This
script composes each page from one set of partials and writes finished, fully
static HTML to the repository root.

    python tools/build.py

No packages required — standard library only. Re-run it after editing anything
under tools/. Never hand-edit the generated .html files in the site root; edit
tools/pages/<name>.html or tools/partials/ and rebuild.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIALS = ROOT / "tools" / "partials"
PAGES = ROOT / "tools" / "pages"

SITE_URL = "https://signiasolutions.com"
SITE_NAME = "Signia Solutions"
OG_IMAGE = f"{SITE_URL}/assets/img/og-default.png"

# --------------------------------------------------------------------------
# Page manifest — one entry per URL.
#   out      : path written, relative to the repo root
#   url      : canonical path (must match sitemap.xml)
#   nav      : which primary nav item gets aria-current="page" ("" for none)
#   priority : sitemap priority
#   changefreq: sitemap change frequency
#   noindex  : True to exclude from search engines AND from the sitemap
# --------------------------------------------------------------------------
PAGES_MANIFEST = [
    {
        "src": "index.html",
        "out": "index.html",
        "url": "/",
        "nav": "",
        "title": "After-Hours RN Triage for Senior Living | Signia Solutions",
        "description": "Experienced RNs answer your community's after-hours calls — assessing urgency, guiding staff and documenting every call. Flat-fee, census-aligned pricing.",
        "og_title": "After-Hours RN Triage for Senior Living | Signia Solutions",
        "og_description": "Calm, clinically sound after-hours RN triage for senior living communities. Experienced RNs, every call documented, flat-fee pricing.",
        "priority": "1.0",
        "changefreq": "monthly",
    },
    {
        "src": "nurse-triage.html",
        "out": "nurse-triage/index.html",
        "url": "/nurse-triage/",
        "nav": "/nurse-triage/",
        "title": "Nurse Triage for Assisted Living & Memory Care | Signia",
        "description": "How after-hours RN triage works: six reasons it matters, our five-step workflow, and the impact on resident safety, ER transfers and staff confidence.",
        "og_title": "After-Hours Nurse Triage for Senior Living Communities",
        "og_description": "Not a call center — clinical partnership. See the five-step workflow our RNs follow on every after-hours call.",
        "priority": "0.9",
        "changefreq": "monthly",
    },
    {
        "src": "who-we-are.html",
        "out": "who-we-are/index.html",
        "url": "/who-we-are/",
        "nav": "/who-we-are/",
        "title": "Who We Are | Signia Solutions After-Hours RN Triage",
        "description": "Signia Solutions was built to close the after-hours gap in senior living. Meet our values, the communities we serve and how we partner with your team.",
        "og_title": "Who We Are | Signia Solutions",
        "og_description": "Experienced RNs closing the after-hours gap for senior living communities. Every call. Every shift. Every night.",
        "priority": "0.8",
        "changefreq": "yearly",
    },
    {
        "src": "careers.html",
        "out": "careers/index.html",
        "url": "/careers/",
        "nav": "/careers/",
        "title": "Nursing Careers — Remote RN Triage Jobs | Signia Solutions",
        "description": "Join a team of experienced triage nurses. Supportive culture, competitive compensation and real professional growth. Apply today.",
        "og_title": "Start Your Journey — Nursing Careers at Signia Solutions",
        "og_description": "Experienced, compassionate nurses wanted. Supportive environment, competitive compensation, room to grow.",
        "priority": "0.7",
        "changefreq": "monthly",
    },
    {
        "src": "contact.html",
        "out": "contact/index.html",
        "url": "/contact/",
        "nav": "/contact/",
        "title": "Contact Signia Solutions | After-Hours RN Triage",
        "description": "Talk to our clinical and operations team about after-hours triage for your community. Call (763) 308-3282 — most inquiries answered within one business day.",
        "og_title": "Contact Signia Solutions",
        "og_description": "We're here when your community needs us. Call (763) 308-3282 or send us a message.",
        "priority": "0.8",
        "changefreq": "yearly",
    },
    {
        "src": "privacy.html",
        "out": "privacy/index.html",
        "url": "/privacy/",
        "nav": "",
        "title": "Privacy Policy | Signia Solutions",
        "description": "How Signia Solutions collects, uses and protects information submitted through signiasolutions.com.",
        "priority": "0.2",
        "changefreq": "yearly",
    },
    {
        "src": "accessibility.html",
        "out": "accessibility/index.html",
        "url": "/accessibility/",
        "nav": "",
        "title": "Accessibility Statement | Signia Solutions",
        "description": "Our commitment to WCAG 2.2 AA accessibility on signiasolutions.com, and how to tell us about a barrier you hit.",
        "priority": "0.2",
        "changefreq": "yearly",
    },
    {
        "src": "404.html",
        "out": "404.html",
        "url": "/404.html",
        "nav": "",
        "title": "Page Not Found | Signia Solutions",
        "description": "That page could not be found.",
        "noindex": True,
    },
]

HEAD_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#38a6e9">
<meta name="author" content="Signia Solutions">

<!-- Open Graph / Twitter -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Signia Solutions">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{og_description}">
<meta property="og:image" content="{og_image}">
<meta property="og:image:alt" content="Signia Solutions — after-hours RN triage for senior living communities">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{og_title}">
<meta name="twitter:description" content="{og_description}">
<meta name="twitter:image" content="{og_image}">

<!-- Icons -->
<link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32">
<link rel="icon" href="/assets/img/signia-mark.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

<link rel="stylesheet" href="/assets/css/site.css?v={css_v}">
<script src="/assets/js/site.js?v={js_v}" defer></script>

<script type="application/ld+json">
{jsonld}
</script>
</head>
<body>

<a class="skip-link" href="#main">Skip to main content</a>

"""


# --------------------------------------------------------------------------
# Structured data
# --------------------------------------------------------------------------
ADDRESS = {
    "@type": "PostalAddress",
    "streetAddress": "10405 6th Ave N",
    "addressLocality": "Plymouth",
    "addressRegion": "MN",
    "postalCode": "55441",
    "addressCountry": "US",
}

ORGANIZATION = {
    "@type": "Organization",
    "@id": f"{SITE_URL}/#organization",
    "name": SITE_NAME,
    "url": f"{SITE_URL}/",
    "logo": {
        "@type": "ImageObject",
        "url": f"{SITE_URL}/assets/img/icon-512.png",
        "width": 512,
        "height": 512,
    },
    "description": "Signia Solutions provides RN-led after-hours triage for senior living communities, with structured clinical guidance and documentation on every call.",
    "telephone": "+1-763-308-3282",
    "faxNumber": "+1-612-395-5381",
    "email": "hi@signiasolutions.com",
    "address": ADDRESS,
    "areaServed": {"@type": "Country", "name": "United States"},
    "knowsAbout": [
        "After-hours nurse triage",
        "Assisted living clinical support",
        "Memory care",
        "Senior living operations",
        "Registered nurse telephone triage",
    ],
}

LOCAL_BUSINESS = {
    "@type": ["MedicalBusiness", "LocalBusiness"],
    "@id": f"{SITE_URL}/#localbusiness",
    "name": SITE_NAME,
    "parentOrganization": {"@id": f"{SITE_URL}/#organization"},
    "url": f"{SITE_URL}/",
    "image": f"{SITE_URL}/assets/img/icon-512.png",
    "telephone": "+1-763-308-3282",
    "email": "hi@signiasolutions.com",
    "priceRange": "$$",
    "address": ADDRESS,
    "openingHoursSpecification": [
        {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
                "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday", "Sunday",
            ],
            "opens": "00:00",
            "closes": "23:59",
            "description": "After-hours clinical triage line available to partner communities every night, weekend and holiday.",
        }
    ],
}

WEBSITE = {
    "@type": "WebSite",
    "@id": f"{SITE_URL}/#website",
    "url": f"{SITE_URL}/",
    "name": SITE_NAME,
    "publisher": {"@id": f"{SITE_URL}/#organization"},
    "inLanguage": "en-US",
}

SERVICE = {
    "@type": "Service",
    "@id": f"{SITE_URL}/nurse-triage/#service",
    "name": "After-Hours RN Nurse Triage for Senior Living Communities",
    "serviceType": "After-hours registered nurse telephone triage",
    "provider": {"@id": f"{SITE_URL}/#organization"},
    "areaServed": {"@type": "Country", "name": "United States"},
    "audience": {
        "@type": "Audience",
        "audienceType": "Assisted living, memory care and independent living operators",
    },
    "url": f"{SITE_URL}/nurse-triage/",
    "description": (
        "RN-led triage for every after-hours call, with evidence-based guidance for staff, "
        "documentation and leadership notifications, custom escalation pathways, policies and "
        "procedures, quality "
        "reporting and predictable census-aligned flat-fee pricing."
    ),
    "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "After-hours clinical support",
        "itemListElement": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}}
            for n in [
                "RN-led triage for every after-hours call",
                "Clear, evidence-based guidance for staff",
                "Documentation and leadership notifications",
                "Custom escalation pathways, policies and procedures",
                "Quality reporting and analytics",
                "Predictable, census-aligned flat fee pricing",
            ]
        ],
    },
}

# Answers here are the ones a person actually asks before buying. They are also
# what an AI answer engine will quote, so each one stands alone without context.
FAQ_ITEMS = [
    (
        "What is after-hours nurse triage for senior living?",
        "After-hours nurse triage gives your caregivers a registered nurse to call when the "
        "building quiets and on-site clinical leadership has gone home. The RN assesses the "
        "resident's symptoms, determines urgency, guides staff through a structured evaluation, "
        "recommends a safe next action and documents the call for leadership. It is clinical "
        "decision support, not an answering service that takes a message.",
    ),
    (
        "How is Signia Solutions different from an answering service or call center?",
        "An answering service records a message and passes it along. Signia's calls are answered "
        "by an experienced registered nurse who assesses the situation, applies evidence-based "
        "clinical guidance and your community's own policies, procedures and escalation pathways, "
        "and gives "
        "your caregiver a specific next step. Every call is documented and sent to leadership.",
    ),
    (
        "Does nurse triage reduce unnecessary ER transfers?",
        "That is the intent. Many after-hours transfers happen because staff feel uncertain or "
        "families feel anxious rather than because the resident needs an emergency department. "
        "An on-call RN helps staff distinguish true emergencies from concerns that can be safely "
        "monitored on site, which reduces stress, cost and hospital exposure for the resident.",
    ),
    (
        "Which communities does Signia Solutions serve?",
        "Assisted living, memory care, independent living with clinical oversight, multi-building "
        "campuses, and regional or enterprise operators. The model works for a single community "
        "as well as an operator running many buildings across markets.",
    ),
    (
        "How does Signia Solutions pricing work?",
        "Pricing is a flat monthly fee aligned to your census, built from RN wage "
        "economics. That gives you a predictable monthly cost rather than per-call billing that "
        "spikes in a hard month.",
    ),
    (
        "Do your nurses follow our escalation policies?",
        "Yes. We operate as an extension of your team, following your policies, procedures and "
        "escalation pathways. Your on-call tree, your notification thresholds and your clinical standards "
        "are built into the workflow before the first call, so decisions align with how your "
        "community already works.",
    ),
    (
        "What happens after a call is completed?",
        "Every call is documented and sent to leadership for transparency and follow-through. If "
        "the situation requires leadership involvement or emergency services, the RN initiates "
        "the appropriate pathway under your policies and procedures at the time of the call "
        "rather than waiting for morning.",
    ),
    (
        "Where is Signia Solutions located?",
        "Signia Solutions is based at 10405 6th Ave N, Plymouth, Minnesota 55441. "
        "You can reach us at (763) 308-3282.",
    ),
]


def breadcrumb(url: str, label: str) -> dict:
    items = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": f"{SITE_URL}/",
        }
    ]
    if url != "/":
        items.append(
            {
                "@type": "ListItem",
                "position": 2,
                "name": label,
                "item": f"{SITE_URL}{url}",
            }
        )
    return {"@type": "BreadcrumbList", "@id": f"{SITE_URL}{url}#breadcrumb", "itemListElement": items}


def page_jsonld(page: dict) -> str:
    url = page["url"]
    canonical = f"{SITE_URL}/" if url == "/" else f"{SITE_URL}{url}"

    page_types = {
        "/": "WebPage",
        "/nurse-triage/": "WebPage",
        "/who-we-are/": "AboutPage",
        "/careers/": "WebPage",
        "/contact/": "ContactPage",
        "/privacy/": "WebPage",
        "/accessibility/": "WebPage",
    }

    webpage = {
        "@type": page_types.get(url, "WebPage"),
        "@id": f"{canonical}#webpage",
        "url": canonical,
        "name": page["title"],
        "isPartOf": {"@id": f"{SITE_URL}/#website"},
        "about": {"@id": f"{SITE_URL}/#organization"},
        "description": page["description"],
        "inLanguage": "en-US",
        "breadcrumb": {"@id": f"{SITE_URL}{url}#breadcrumb"},
    }

    graph = [ORGANIZATION, LOCAL_BUSINESS, WEBSITE, webpage, breadcrumb(url, page.get("crumb", page["title"]))]

    if url in ("/", "/nurse-triage/"):
        graph.append(SERVICE)

    # FAQPage lives on exactly one URL. Duplicating the same Q&A set across
    # pages competes with itself and Google treats it as a quality signal.
    if url == "/nurse-triage/":
        graph.append(
            {
                "@type": "FAQPage",
                "@id": f"{canonical}#faq",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in FAQ_ITEMS
                ],
            }
        )

    return json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2, ensure_ascii=False)


def render_faq() -> str:
    """Render the visible FAQ from the same source list that feeds FAQPage
    schema. Google requires the answer text to be present on the page; keeping
    one source of truth is what guarantees the markup never outruns the copy."""
    blocks = []
    for q, a in FAQ_ITEMS:
        blocks.append(
            "        <details>\n"
            f"          <summary>{q}</summary>\n"
            f'          <div class="faq__body"><p>{a}</p></div>\n'
            "        </details>"
        )
    return "\n".join(blocks)


def mark_active(header_html: str, nav_href: str) -> str:
    if not nav_href:
        return header_html
    return header_html.replace(
        f'<li><a href="{nav_href}">',
        f'<li><a href="{nav_href}" aria-current="page">',
        1,
    )


def asset_version(rel: str) -> str:
    """Short content hash appended to the CSS/JS URLs.

    Without it a browser serves a cached stylesheet after a deploy and the change
    looks like it never shipped. The hash moves only when the file does, so
    caching stays aggressive and correctness stops depending on anyone
    remembering to hard-refresh.

    Line endings are normalised before hashing. Git stores LF but checks out CRLF
    on Windows (core.autocrlf=true), so hashing raw bytes made the token depend on
    WHICH MACHINE ran the build rather than on the file's content: site.js hashed
    to 9e1a1c72 on a CRLF checkout and 40a05d94 on an LF one, from a byte-identical
    blob. The committed HTML then flip-flopped between the two, and a build on one
    machine looked like a change on the other. Normalising makes the hash a
    property of the content, which is the only thing it was ever meant to track.
    """
    raw = (ROOT / rel).read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(raw).hexdigest()[:8]


def build() -> int:
    css_v = asset_version("assets/css/site.css")
    js_v = asset_version("assets/js/site.js")
    sprite = (PARTIALS / "sprite.html").read_text(encoding="utf-8").rstrip()
    header = (PARTIALS / "header.html").read_text(encoding="utf-8").rstrip()
    footer = (PARTIALS / "footer.html").read_text(encoding="utf-8").rstrip()

    written = []
    for page in PAGES_MANIFEST:
        body = (PAGES / page["src"]).read_text(encoding="utf-8").rstrip()
        body = body.replace("<!--FAQ-->", render_faq())
        url = page["url"]
        canonical = f"{SITE_URL}/" if url == "/" else f"{SITE_URL}{url}"
        robots = (
            "noindex, follow"
            if page.get("noindex")
            else "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        )

        head = HEAD_TEMPLATE.format(
            title=page["title"],
            description=page["description"],
            canonical=canonical,
            robots=robots,
            og_title=page.get("og_title", page["title"]),
            og_description=page.get("og_description", page["description"]),
            og_image=OG_IMAGE,
            jsonld=page_jsonld(page),
            css_v=css_v,
            js_v=js_v,
        )

        html = (
            head
            + sprite
            + "\n\n"
            + mark_active(header, page["nav"])
            + "\n\n"
            + body
            + "\n\n"
            + footer
            + "\n\n</body>\n</html>\n"
        )

        out = ROOT / page["out"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        written.append((page["out"], len(html)))

    write_sitemap()
    for name, size in written:
        print(f"  built  {name:<32} {size:>7,} bytes")
    print(f"  built  {'sitemap.xml':<32}")
    print(f"\n{len(written)} pages written to {ROOT}")
    return 0


def write_sitemap() -> None:
    from datetime import date

    today = date.today().isoformat()
    rows = []
    for page in PAGES_MANIFEST:
        if page.get("noindex"):
            continue
        url = page["url"]
        loc = f"{SITE_URL}/" if url == "/" else f"{SITE_URL}{url}"
        rows.append(
            "  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f"    <changefreq>{page.get('changefreq', 'monthly')}</changefreq>\n"
            f"    <priority>{page.get('priority', '0.5')}</priority>\n"
            "  </url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    sys.exit(build())
