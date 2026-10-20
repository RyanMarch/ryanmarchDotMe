# Archived looks

The site ships one look (the one in `public/assets/css/style.css`). These are the other
looks we built and compared before settling on it, kept so they can be picked up
again later. **This folder is not deployed** (it sits outside `public/`,
the only folder Wrangler uploads) and nothing in the build reads it.

They are a snapshot, not drop-ins: they were written against the stylesheet as it
was *before* the final merge, so they sit on `base-before-merge.css`, not on
today's `public/assets/css/style.css`.

## What is here

| File | What it is |
|---|---|
| `base-before-merge.css` | The stylesheet the layered looks sit on (the old "New" look: charcoal-navy, amber accent, DM Sans + Bricolage Grotesque). Also a complete look on its own. |
| `classic.css` | The original blue, glass-card look with floating orbs and the cursor "glimmer" border. A **full replacement** for `base-before-merge.css`, not a layer. |
| `ember.css` | Warm editorial look inspired by the Ember NetNewsWire theme: warm black/off-white, vermilion accent, system fonts, unboxed grid, drop cap, numbered contents. A **layer** on `base-before-merge.css`. |
| `resume.css` | The look that mirrors the résumé PDF: teal top band, tracked-caps Montserrat name, thick teal rules. A **layer** on `ember.css`, which it reuses for layout. |
| `hybrid.css` | The look that was chosen, in its pre-merge form (palette + overrides only). It is now merged into `public/assets/css/style.css`, so this file is for reference. A **layer** on `ember.css`. |
| `fonts/` | Fonts those looks need: DM Sans, Bricolage Grotesque, Montserrat, and the Outfit latin-ext file. |

Layering: `base-before-merge.css` → `ember.css` → `resume.css` **or** `hybrid.css`.
`classic.css` replaces the base instead of layering on it. `ember.css` scopes its
rules with `:root:is([data-look="ember"], [data-look="resume"], [data-look="hybrid"])`,
and each look sets `data-look` on `<html>`.

## Reviving a look

1. Copy the fonts you need from `themes/fonts/` back to `public/assets/fonts/` (the CSS
   references `/assets/fonts/...`).
2. Load the sheets as `<link>`s with ids and set `data-look` on `<html>` (below).
3. `classic.css` also needs the two orb divs back inside `.background-container`
   (`<div class="orb orb-1"></div><div class="orb orb-2"></div>`) and the
   cursor-glimmer script from commit `b0b7ca1` (`index.html`, "Glimmering border").
4. The pre-merge `index.html` markup put the profile paragraph and the LinkedIn /
   GitHub links *inside* `.bio-module`; that markup is unchanged in today's page.

## The look switcher (removed from the site)

Every look lived behind a small switcher. The original code is in git at commit
`b0b7ca1`; that version predates the Hybrid look and the markup change that moved
the profile text and the LinkedIn / GitHub links inside `.bio-module`. The final
working form (all five looks) was:

```html
<!-- in <head>, after the main stylesheet -->
<link rel="stylesheet" id="look-new-css" href="/assets/css/style.css">
<link rel="stylesheet" id="look-classic-css" href="/assets/css/style-classic.css" media="not all">
<link rel="stylesheet" id="look-ember-css" href="/assets/css/style-ember.css" media="not all">
<link rel="stylesheet" id="look-resume-css" href="/assets/css/style-resume.css" media="not all">
<link rel="stylesheet" id="look-hybrid-css" href="/assets/css/style-hybrid.css" media="not all">
<script>
    // ?look=classic|ember|resume|hybrid|new switches it from a URL
    (function () {
        try {
            const q = new URLSearchParams(location.search).get('look');
            if (['classic', 'ember', 'resume', 'hybrid'].includes(q)) localStorage.setItem('look', q);
            else if (q === 'new') localStorage.removeItem('look');
            const look = localStorage.getItem('look');
            if (look === 'classic') {
                document.documentElement.setAttribute('data-look', 'classic');
                document.getElementById('look-new-css').media = 'not all';
                document.getElementById('look-classic-css').media = 'all';
            } else if (['ember', 'resume', 'hybrid'].includes(look)) {
                document.documentElement.setAttribute('data-look', look);
                document.getElementById('look-ember-css').media = 'all';
                if (look === 'resume') document.getElementById('look-resume-css').media = 'all';
                if (look === 'hybrid') document.getElementById('look-hybrid-css').media = 'all';
            }
        } catch (e) { /* storage unavailable: keep the default look */ }
    })();
</script>
```

A disabled sheet uses `media="not all"`; switching at runtime just flips those
`media` values and the `data-look` attribute. The toggle button sat next to the
light/dark button in `.header-actions` and cycled `new → ember → resume → hybrid →
classic`.

## Notes on the chosen look

- Tag colors: only `gold` tags are highlighted (accent); every other tag color
  renders muted. The `color` field is still read and written by `admin.html`,
  `dev/create-project.js` and `tests/projects-validation.test.js`.
- Ember's design is inspired by the Ember NetNewsWire theme by Dave Marquard
  (https://ember.marquard.org, Apache-2.0); no Ember code is copied.
