# Image credits and provenance

Every photograph on this site is recorded here with its source, licence and the
page it appears on. Keep this file updated when images change — if anyone ever
questions the right to use a photo on a commercial healthcare site, this is the
paper trail.

## Licence

All stock photography is from **Pexels**, under the
[Pexels License](https://www.pexels.com/license/) (checked 2026-08-25):

- Free to use, **including commercially**.
- Attribution **not required** (recorded here anyway).
- Modification allowed — all files below are cropped and re-encoded.

Restrictions that actually bind us:

> "Don't imply endorsement of your product by people or brands on the imagery."

> "Identifiable people may not appear in a bad light or in a way that is offensive."

**This is why the alt text describes what is in the frame and never claims the
person is a Signia nurse or a Signia resident.** Writing "our RN taking a call"
under a stock photo would be both an endorsement implication and a false claim
about staff on a healthcare site. Keep the descriptive phrasing.

## Files

| File | Source | Photographer | Used on |
|---|---|---|---|
| `rn-triage-call.webp` | [Pexels 7195317](https://www.pexels.com/photo/7195317/) | Karola G | Home — "The after-hours gap is real" |
| `triage-hero-bg.webp` | Inherited from signiasolutions.com (`2026/03/Night-shift-triage-nurse-at-work.png`) | **AI-generated — see note** | Nurse Triage — page hero background |
| `rn-headset-portrait.webp` | Inherited from signiasolutions.com (`2026/03/A-professional-regis.png`) | **AI-generated — see note** | Contact — "Tell us about your community" |
| `rn-triage-workstation.webp` | [Pexels 7195308](https://www.pexels.com/photo/7195308/) | Karola G | Nurse Triage — "Our RNs support your team by" |
| `senior-living-residents.webp` | [Pexels 39191570](https://www.pexels.com/photo/39191570/) | SilverKBlack | Home — "Who we serve" |
| `nurse-careers.webp` | [Pexels 4930705](https://www.pexels.com/photo/4930705/) | mix-and-match-studio | Careers — "Why Signia" |
| `care-team.webp` | Inherited from the previous signiasolutions.com WordPress site (`2024/03/health-head-2.jpg`) | unknown — **see note** | Home, Who We Are |
| `leadingage-mn-partner.webp` | Inherited from the previous site (`2026/01/2026_BPLogoMinnesota.png`) | LeadingAge Minnesota | Footer, site-wide — **see note** |
| `rn-portrait-band.webp` | Inherited from signiasolutions.com (`2025/01/Hero-CS-Delegated-Utilization-Management.png`) | unknown — commercial stock, **rights unconfirmed** | Home — "How we support you" |
| `hero-rn-bg.webp` | Same original as `rn-portrait-band.webp`, resized for the hero | unknown — commercial stock, **rights unconfirmed** | Home — hero background |
| `care-team-band.webp` | Inherited from signiasolutions.com (`2024/03/hero-bg6.png`) | unknown — commercial stock, **rights unconfirmed** | Home — "The impact on your community" |
| `signia-mark.svg`, `favicon-*.png`, `icon-*.png`, `apple-touch-icon.png` | Traced from the official logo `Signia.png` | Signia Solutions | Site-wide |
| `og-default.png` | Generated for this site from the brand assets | — | Social share card |
| `who-hero-bg.webp` | Same original as `care-team.webp` (`2024/03/health-head-2.jpg`) | unknown — **see note** | Who We Are — page hero background |
| `who-story.webp` | Inherited from signiasolutions.com (`2026/02/cw25_image_modern-workplace-de_02.jpg`) | unknown — commercial stock, **rights unconfirmed** | Who We Are — "Who We Are" |
| `care-faces.webp` | Same original as the retired `care-bedside.webp` (`2024/03/PHOTO-51001274-WEB.jpg`) | unknown — commercial stock, **rights unconfirmed** | Nurse Triage — closing pair |
| `rn-on-phone.webp` | Crop of the same AI original as the Nurse Triage hero, framed on the handset | **AI-generated — see note** | Nurse Triage — closing pair |
| `partnership.webp` | Supplied by Signia (`Partner Booklet.png`) | unknown — **licence unconfirmed, see note** | Who We Are — "How We Partner With You" |

### Note on inherited images

`care-team.webp` and the award badge came from the previous WordPress site. Their
original licence was not documented there, so **confirm Signia holds the rights
to `care-team.webp`** before treating it as cleared — it looks like commercial
stock. If the licence cannot be produced, replace it; a same-shaped substitute
is a ten-minute job.

### The award claim, and what replaced it

The site carried a badge captioned "Best Places to Work Minnesota, 2026" on the
home, who-we-are and careers pages. The artwork was never that award: it is the
**LeadingAge Minnesota 2026 Business Partner** mark — a trade-association partner
designation, which is a paid relationship rather than a competitive award for
being a good employer. Claiming it as the latter on a careers page is the kind of
thing a candidate or a competitor can check. That claim is gone for good.

The mark itself now appears once, in the **footer**, worded as what it is:
"Signia Solutions is a LeadingAge Minnesota business partner." A partnership
stated plainly is a fair claim; an award that was never won is not.

Two things still need confirming, and neither is a design question:

1. That the partnership is **current for 2026** — nothing in this repository or
   on the live site evidences it, only the artwork.
2. That LeadingAge Minnesota's **mark-usage terms** permit display on a
   commercial site.

If either fails, delete the `.footer__partner` block from
`tools/partials/footer.html` and the matching CSS. Nothing else depends on it.

### Note on `partnership.webp`

Supplied directly rather than sourced here, so its licence is not recorded in
this repository. **Confirm Signia holds commercial rights to it** before launch —
if it came from a stock library, the licence needs to cover use on a commercial
website; if it came from a booklet a designer produced, the rights may sit with
the designer or their stock account rather than with Signia.

It is also the smallest photograph on the site at 557x327. That is enough for the
column it sits in and it is not upscaled, but it will look soft on a high-DPI
screen, and it cannot be reused anywhere larger. A higher-resolution original
would fix both.

### Note on the AI-generated images

`triage-hero-bg.webp` and `rn-headset-portrait.webp` were generated, not
photographed — the originals on the WordPress site carry the tell-tale artefacts.
Both were cropped here to remove visible defects: the first had a clipboard
reading "Triage Assessmen?" in broken lettering, the second had the Signia
wordmark baked into the bottom of the raster. Residual small artefacts remain in
the first (scrambled micro-text on the ID badge lanyard) — legible only when
zoomed, but they are there.

Two things follow. There is **no model release**, because there is no model, so
these cannot be captioned as Signia staff. And on a healthcare site, synthetic
clinical imagery is a credibility risk if a visitor spots it. Prefer real
photography of the actual team as soon as it exists.

## Processing

Originals were downloaded at 1800px, centre-cropped with a slight upward bias so
faces are not cut at the forehead, resized, and encoded as WebP at quality 82.
Every `<img>` carries explicit `width` and `height` so the layout cannot shift
while images load, and everything below the fold is `loading="lazy"`.

## The real recommendation

This is stock, and it looks like stock. For a healthcare service the strongest
imagery is your own: real Minnesota nurses, named, with credentials. That is not
only better photography, it is a direct search-ranking factor — Google's
quality guidance weighs demonstrated experience and expertise heavily for
health-related sites, and a named clinical team with real photos is one of the
clearest signals you can send. Treat these files as a good placeholder, not the
destination.
