<div align="center">
  <h1>Motion Poster</h1>
  <p><i>A professional, browser-based display for gala fundraisers, parties, and event venues.</i></p>

  [<img src="https://img.shields.io/badge/Open_Motion_Poster-87A96B?style=for-the-badge&logoColor=white" style="scale:1.5;" alt="Live Demo" height="45" />][demo]

  <br>

  [<img src=".github/assets/eventPoster.avif" alt="Event Poster Preview" width="100%">][demo]

  <!-- <video src="https://github-production-user-asset-6210df.s3.amazonaws.com/6699010/584341152-c1e34246-41ab-4b53-bd2d-faef1478f243.mp4" 
         poster=".github/assets/eventPoster.avif" 
         width="100%" controls muted autoplay loop disablepictureinpicture playsinline>
    <img src=".github/assets/eventPoster.avif" alt="Event Poster Preview">
  </video> -->
</div>


## Overview
[Motion Poster](https://motionposter.ryanmarch.me) is a professional-grade, browser-based display tool designed for gala fundraisers, non-profit events, and high-end venue kiosks. It replaces static slides and paper posters with a living, breathing digital poster that captures attention and elevates the atmosphere of any physical space.

Designed with a "set it and forget it" philosophy, this tool allows event managers to customize every detail in real-time. You can adjust everything from the physics of falling petals to the names of host committee members to ensure your presentation is always perfect.

**Quick start:** Open **[Motion Poster](https://motionposter.ryanmarch.me)**, make your customizations, and you're ready to go!

## Contents
  - [Key Benefits](#key-benefits)
  - [Features](#features)
    - [Atmospheric Elegance](#atmospheric-elegance)
    - [Remote Control](#remote-control)
  - [Themes](#themes)
  - [Theme Screenshots](#theme-screenshots)
    - [📦 Standard Pack](#-standard-pack-1)
    - [🥳 Party Pack](#-party-pack-1)
    - [🪩 Decades Pack](#-decades-pack-1)
    - [🌌 Specialty Pack](#-specialty-pack-1)
    - [🎃 Holiday Pack](#-holiday-pack-1)
  - [Getting Started](#getting-started)
    - [Keyboard Shortcuts](#keyboard-shortcuts)
    - [Other Triggers](#other-triggers)
  - [Easy Customization](#easy-customization)
    - [Content Editor](#content-editor)
    - [Name Management](#name-management)
    - [Appearance & Performance Settings](#appearance-performance-settings)
  - [Quick Controls](#quick-controls)
    - [Status](#status)
    - [Customize Appearance](#customize-appearance)
    - [Add and Remove Hosts](#add-and-remove-hosts)
    - [Edit Poster Content](#edit-poster-content)
    - [Controls Screenshots](#controls-screenshots)
  - [Using the Remote Control](#using-the-remote-control)
  - [Project Architecture and Technical Specs](#project-architecture-and-technical-specs)
    - [File Structure](#file-structure)
    - [Persistence Strategy](#persistence-strategy)
    - [Technical Specifications](#technical-specifications)
    - [Technical Architecture: Remote Syncing](#technical-architecture-remote-syncing)
    - [Display Notes](#display-notes)
  - [Version History](#version-history)

## Key Benefits
*   **Easy To Use:** Choose your theme, add content, and you're ready to go.
*   **Your Branding, Your Customization:** All customizations, including uploaded logos and QR codes, are saved directly into your browser. They persist through refreshes and restarts, so your work is never lost.
*   **Live Edits, No Disruptions:** A management panel allows you to update text and settings on the fly.
*   **Untethered Remote Control:** Easily pair a secondary device to control all layouts, text, and styling in real-time from anywhere.
*   **Event Reliability:** Built-in features prevent the screen from sleeping and ensure the poster automatically recovers if the power blinks or the page refreshes.

## Features

### Atmospheric Elegance
*   **Dynamic Visual Identity:** Instantly swap between professional, seasonal, or high-energy themes to match the tone of your gathering.
*   **Theme-Specific Frames:** From elegant floral borders to rustic wood cabinets and frosted glass, each theme provides a unique window into your event.
*   **Multi-Atmosphere Particle Engine:** Depending on your theme, experience falling cherry blossoms, snowflakes, dust motes, or celebratory geometric particles subtly drifting through the display.
*   **Adjustable Physics:** Fine-tune wind frequency, fall speed, and tumble rotation to create a natural environment that fits your needs.

### Remote Control
*   **No App Required:** Access controls from any web browser on any device (e.g. iPhone, iPad, etc.) - no app download needed.
*   **Easy Pairing:** Grab a pairing code to start access from another device. 
*   **Customize appearance**: Choose themes, pick colors, tweak the layout, and add event details.
*   **Name Management**: Add or remove names from the host list.

Remote control allows for full poster control, all from the comfort of your seat. No need to go back to the presentation display.

Remote pairing requires the remote device to be on the same network as the host device. Note that cellular hotspots work well for this purpose if you're not on a local Wi-Fi network.

*More: [Using the Remote Control](#using-the-remote-control)*

## Themes
Choose from multiple themes, each with its own unique particle engine, decorative frame, and color palette. 30 themes are available with 276 built-in color schemes to get you started.

### 📦 Standard Pack
*   **[Spring Blossom][demo-spring]:** Delicate cherry blossoms and elegant floral framing.
*   **[Digital Grid][demo-digital-grid]:** High-tech accents and techy-glass with striking light beams.
*   **[Alpine Winter][demo-alpine-winter]:** Frosted glass window and a rustic wood frame with a gentle snowfall effect.
*   **[Vintage Radio][demo-vintage-radio]:** Warm wood textures, with a tuning needle and floating particles of light.
*   **[Corporate Pro][demo-corporate]:** Modern geometric shapes and professional, abstract gradients.
*   **[Minimal Elegance][demo-minimal-elegance]**: A sophisticated and high-fashion design perfect for art galleries, museums, and brand showcases.

### 🥳 Party Pack
*   **[Electric Pulse][demo-electric-pulse]:** High-energy music festival with neon lights, geometric patterns, and drifting light particles.
*   **[Celebration][demo-celebration]:** Festive and fun with confetti, balloons, and a celebratory atmosphere.
*   **[Summer Cookout][demo-summer-cookout]:** Warm and inviting with a summer cookout theme.
*   **[Tropical Oasis][demo-tropical-oasis]:** Refreshing and vibrant with a tropical oasis theme.
*   **[Casino Night][demo-casino-night]:** Glamorous casino table with felt textures, gold borders, corner card fans, clicky poker chip stacks, and floating card suit particles.
*   **[Karaoke Night][demo-karaoke-night]:** A vibrant and energetic theme featuring a neon-drenched karaoke bar aesthetic, complete with floating musical notes, disco lighting, and a dynamic color palette.

### 🪩 Decades Pack
*   **[Retro Wave][demo-retro-wave]:** Retro sunsets, tropical palm trees, and neon vibes with a chasing grid pattern.
*   **[Disco Fever][demo-disco-fever]:** Funky retro dance experience with a spinning disco ball, pulsing spotlights, a dance floor grid, and drifting light reflections.
*   **[Art Deco Gala][demo-art-deco-gala]:** Glamorous and geometric Roaring 20s style with a repeating gold Art Deco pattern, swaying crystal chandelier, corner champagne flutes, and a mix of gold dust, sparkles, and rising champagne bubble particles.
*   **[Atomic Mid-Century][demo-atomic-mid-century]:** A retro 1950s-1960s style with atomic shapes, geometric patterns, and bold colors.
*   **[Memphis Pop][demo-memphis-pop]:** Vibrant and bold 1980s-1990s Memphis design with geometric shapes, diagonal stripes, and high-contrast colors. A playful and energetic theme perfect for creative events.
*   **[2000s Glass][demo-00-glass]:** Bring back the glass and frosted surfaces with a mid-2000s vibe.

### 🌌 Specialty Pack
*   **[Cinema Premiere][demo-cinema]:** Dramatic theater curtains, red velvet styling, marquee glow, dust slowly drifting through the projector beam, and even a little bit of popcorn.
*   **[Game Console][demo-game-console]:** Video gaming fun with CRT monitor styling, pixel art buttons, and console control outlines.
*   **[Space Odyssey][demo-space-odyssey]:** A futuristic, deep-space theme featuring diagonal shooting stars, a futuristic HUD overlay, and slow-moving galactic nebulas.
*   **[Bistro Lounge][demo-bistro-lounge]:** A sophisticated and intimate speakeasy atmosphere with warm wood textures, elegant brass accents, and a cozy, ambient glow.
*   **[Steampunk Gears][demo-steampunk-gears]:** A Steampunk-themed showcase featuring exposed brass gears, Victorian-era industrial design, and atmospheric floating steam particles.
*   **[Deep Blue Sea][demo-deep-blue]:** A serene aquarium theme with gentle underwater light rays and tranquil ocean colors.

### 🎃 Holiday Pack
*   **[Halloween Soiree][demo-halloween]:** Spooky pumpkins, drifting ghosts, and deep shadows with eerie glowing particles, perfect for haunted events.
*   **[Autumn Harvest][demo-autumn-harvest]:** A cozy fall celebration with falling leaves, evoking the changing of the season and the many colors of leaves.
*   **[Valentines Romance][demo-valentines-romance]:** A romantic Valentine's Day celebration with red hearts, pink accents, and a festive atmosphere.
*   **[Mardi Gras][demo-mardi-gras]:** Festive masquerade carnival with beads, masks, and a celebratory atmosphere.
*   **[Festive Holiday][demo-festive-holiday]:** A festive holiday celebration with lights, decorations, trees and a festive atmosphere.
*   **[New Year's Eve][demo-new-years-eve]:** A glamorous New Year's Eve celebration with gold accents, confetti, and a festive atmosphere.

## Theme Screenshots

### 📦 Standard Pack
| | |
| :---: | :---: |
| **Spring Blossom** – *Fresh & Elegant* <br> [![Spring Blossom](.github/assets/eventPoster.avif)][demo-spring] | **Digital Grid** – *High-Tech & Modern* <br> [![Digital Grid](.github/assets/poster-digital.avif)][demo-digital-grid] |
| **Alpine Winter** – *Frosty & Rustic* <br> [![Alpine Winter](.github/assets/poster-winter.avif)][demo-alpine-winter] | **Vintage Radio** – *Warm & Nostalgic* <br> [![Vintage Radio](.github/assets/poster-radio.avif)][demo-vintage-radio] |
| **Corporate Pro** – *Sleek & Professional* <br> [![Corporate Pro](.github/assets/poster-corporate.avif)][demo-corporate] | **Minimal Elegance** – *Sophisticated & Fashion-Forward* <br> [![Minimal Elegance](.github/assets/poster-minimal.avif)][demo-minimal-elegance] |

### 🥳 Party Pack
| | |
| :---: | :---: |
| **Electric Pulse** – *High-Energy Music Festival* <br> [![Electric Pulse](.github/assets/poster-electric-pulse.avif)][demo-electric-pulse] | **Celebration** – *Festive & Fun* <br> [![Celebration Time](.github/assets/poster-celebration.avif)][demo-celebration] |
| **Summer Cookout** – *Warm & Inviting* <br> [![Summer Cookout](.github/assets/poster-cookout.avif)][demo-summer-cookout] | **Tropical Oasis** – *Refreshing & Vibrant* <br> [![Tropical Oasis](.github/assets/poster-tropical-oasis.avif)][demo-tropical-oasis] |
| **Casino Night** – *Gala Games & Fun* <br> [![Casino Night](.github/assets/poster-casino-night.avif)][demo-casino-night] | **Karaoke Night** – *Sing Your Heart Out* <br> [![Karaoke Night](.github/assets/poster-karaoke-night.avif)][demo-karaoke-night] |

### 🪩 Decades Pack
| | |
| :---: | :---: |
| **Retro Wave** – *Neon Nights & Good Vibes* <br> [![Retro Wave](.github/assets/poster-retro-wave.avif)][demo-retro-wave] | **Disco Fever** – *Retro Dance Party* <br> [![Disco Fever](.github/assets/poster-disco-fever.avif)][demo-disco-fever] |
| **Art Deco Gala** – *Glamorous Art Deco* <br> [![Art Deco Gala](.github/assets/poster-art-deco.avif)][demo-art-deco-gala] | **Atomic Mid-Century** – *Mid-Century Modern Style* <br> [![Atomic Mid-Century](.github/assets/poster-mid-century.avif)][demo-atomic-mid-century] |
| **Memphis Pop** – *Vibrant 80s-90s Style* <br> [![Memphis Pop](.github/assets/poster-memphis-pop.avif)][demo-memphis-pop] | **00s Glass** – *Clear & Fresh* <br> [![00s Glass](.github/assets/poster-00s-glass.avif)][demo-00-glass] | 

### 🌌 Specialty Pack
| | |
| :---: | :---: |
| **Cinema Premiere** – *Dramatic Movie Premiere* <br> [![Cinema Premiere](.github/assets/poster-cinema.avif)][demo-cinema] | **Game Console** – *Video Gaming Fun* <br> [![Game Console](.github/assets/poster-game-console.avif)][demo-game-console] |
| **Space Odyssey** – *Futuristic Deep Space* <br> [![Space Odyssey](.github/assets/poster-space-odyssey.avif)][demo-space-odyssey] | **Bistro Lounge** – *Cozy Cafe Atmosphere* <br> [![Bistro Lounge](.github/assets/poster-bistro-lounge.avif)][demo-bistro-lounge] |
| **Steampunk Gears** – *Victorian Industrial* <br> [![Steampunk Gears](.github/assets/poster-steampunk-gears.avif)][demo-steampunk-gears] | **Deep Blue Sea** – *Calm Aquarium* <br> [![Deep Blue Sea](.github/assets/poster-deep-blue.avif)][demo-deep-blue] |

### 🎃 Holiday Pack
| | |
| :---: | :---: |
| **Halloween Soiree** – *Spooky & Atmospheric* <br> [![Halloween Soiree](.github/assets/poster-halloween-soiree.avif)][demo-halloween] | **Autumn Harvest** – *Cozy Autumn Vibes* <br> [![Autumn Harvest](.github/assets/poster-autumn-harvest.avif)][demo-autumn-harvest] |
| **Valentines Romance** – *Romantic & Festive* <br> [![Valentines Romance](.github/assets/poster-valentines-romance.avif)][demo-valentines-romance] | **Mardi Gras** – *Festive Masquerade Carnival* <br> [![Mardi Gras](.github/assets/poster-mardi-gras.avif)][demo-mardi-gras] | 
| **Festive Holiday** – *Christmas & Winter Fun* <br> [![Festive Holiday](.github/assets/poster-festive-holiday.avif)][demo-festive-holiday] | **New Year's Eve** – *Festive New Year's Eve* <br> [![New Year's Eve](.github/assets/poster-new-years-eve.avif)][demo-new-years-eve] | 

## Getting Started
1.  **Launch:** Open **[Motion Poster](https://motionposter.ryanmarch.me/)** in a large-screen web browser.
2.  **Enter Fullscreen:** Press **'F'** on your keyboard to enter presentation mode.
3.  **Open Options:** Press **'Q'** (Quick Controls) to start customizing your poster.
4.  **Set Your Branding:** Choose your theme, upload your logo and QR codes, and add your host names.
5.  **Display:** Plug your computer into a large display or projector and let it run!
6. **Wireless Remote:** Optionally, [pair a wireless remote](#using-the-remote-control) by pressing **'W'** on your keyboard.


### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen |
| `Q` | Toggle the Options panel |
| `C` | Toggle the Customize Appearance section |
| `E` | Edit Poster Text |
| `A` | Toggle the Add/Remove Names section |
| `R` | Reset appearance to defaults (while in Customize section) |
| `?` | Show Help Menu |
| `W` | Open Wireless Remote panel |
| `Esc` | Close panel or dismiss forms |
| Hold `\` | **Factory Reset:** Wipe all local data and restore defaults |


### Other Triggers
*   **Open Menu:** Tap and hold the top-right corner of the screen to open the settings panel without a keyboard.
*   **Remove Host:** Tap and hold any name in the Host Committee list to remove it from the display.


## Easy Customization

### Content Editor
*   **Custom-To-You Branding:** Add your organization name and upload custom logos directly in the browser.
*   **Event Details:** Change the event title, subtitle, and date via the Edit panel.
*   **Smart QR Display:** Overlay QR codes for event registration or donation pages. Upload your own images and they remain saved for future use.
*   **Visual Layout Control:** Independently toggle the visibility of every element, including the logo, title, date, the host list, and even the background animations.

### Name Management
*   **Seamless Entry:** Easily add or remove names one at a time via the form.
*   **Interactive Removal:** Remove a name quickly by holding down on a name, or choose it from the list to remove it.
*   **Smart Font Scaling:** The names list automatically adjusts its font size and layout to fit your screen perfectly, whether you have 5 names or 50.
*   **Flexible Layout Modes:** Choose between Justified, Centered, or Column-based layouts to suit your aesthetic preferences.
*   **Safety Net:** Recently removed names are stored in a "Recently Removed" list within the menu, allowing you to restore them with a single click if you make a mistake.

### Appearance & Performance Settings
*   **Hardware Wake Lock:** Automatically tells the computer to stay awake, preventing screensavers or sleep modes during your event.
*   **Auto-Fullscreen Recovery:** Remembers your fullscreen state. If the browser reloads, it's easy to jump back into presentation mode.
*   **Touch-Friendly Hotspot:** No keyboard? No problem. A hidden "hold" zone in the top-right corner allows you to open settings with a tap-and-hold.
*   **Performance Engineering:**
    *   **Frame Rate Limiter:** Cap performance at 30, 60, 90, or 120 FPS to save battery or ensure smooth motion on high-refresh displays.
    *   **Smooth Transitions:** Toggle UI animations for a snappier feel or a more cinematic experience.
*   **Styling Lab:**
    *   **Text Backdrop Strength:** Add more separation and legibility for names against complex backgrounds.
    *   **Layout Control:** Fine-tune the **Max Width**, **Vertical Spacing**, and **Horizontal Spacing** to fit any screen.
    *   **Live Color Picker:** Match the background and accent colors to your brand's specific palette.

## Quick Controls

All text and appearance settings on the poster are controlled via an intuitive management interface in the app. No coding required.

### Status
- **Fullscreen toggle** — puts the browser into fullscreen mode and activates Wake Lock to prevent the screen from sleeping
- **Performance stats** — live FPS counter, screen resolution, fullscreen session timer, and Wake Lock status

### Customize Appearance
- **Theme Switcher** — Choose from curated visual identities like Corporate Pro, Alpine Winter, Vintage Radio, or Spring Blossom.
- **Particle Dynamics** — Adjust the count, speed, and windiness of atmospheric effects (petals, snow, etc.).
- **Intensity Controls** — Scale the movement of background frames and swaying elements.
- **Theme-Specific Controls** — UI labels automatically update to match your theme (e.g., "Petal Count" vs "Snowflake Count").
- **Host Layout** — Justify, Centered, or Columns.
- **Host Text Size / Max Width** — Scale and constrain the host list.
- **Vertical / Horizontal Inset** — Adjust content margins from the border.
- **Color Palettes** — Change background and accent colors using theme-specific swatches or a custom color picker.
- **Backdrop Opacity** — Fade the overlay behind the host list for better legibility.
- **QR Code Overlays** — Independently toggle left and right QR code areas.
- **Show/Hide Toggles** — Logo, event title, date, host list, and theme frames.
- **Disable auto-fullscreen** — Prevent the fullscreen restoration after refresh.

### Add and Remove Hosts
- Add host names one at a time via a form (supports Enter key, detects duplicates)
- Once any host is added by the user, the default/sample names get replaced
- Remove individual hosts; recently removed hosts can be put back

### Edit Poster Content

-   **All Text:** Change organization name, event title, subtitle, date, and top label. Or choose your own content for these fields.
-   **Logos:** PNG files with transparency are recommended.
-   **QR Codes:** Upload your own QR codes for event registration or donation pages. Use any standard QR code image format (PNG, JPG, etc) and ensure the image is clear and high resolution for best readability.

### Controls Screenshots

| **Main Controls** | **Name Management** |
|:---:|:---:|
| [![Main Options](.github/assets/mgmt-main.avif)][demo] <br> *Live stats & toggles.* | [![Hosts](.github/assets/mgmt-hosts.avif)][demo] <br> *Real-time list editing.* |

| **Content Editor** | **Appearance Settings** | **Help & Guidelines** |
|:---:|:---:|:---:|
| [![Content](.github/assets/mgmt-content.avif)][demo] <br> *Logos, titles, and QRs.* | [![Appearance](.github/assets/mgmt-appearance.avif)][demo] <br> *Physics & layout sliders.* | [![Help](.github/assets/mgmt-help.avif)][demo] <br> *Hotkeys & asset specs.* |

## Using the Remote Control
1. Launch the motion poster on your primary device.
2. Open the control panel and click **Wireless Remote** - or press the **W** key.
3. Using a secondary device (e.g., an iPhone or iPad), connect using one of three methods:
   - Scan the on-screen **QR Code**.
   - Navigate to the displayed URL and enter the **Pairing Code**.
   - Copy and share the direct link.
4. Once connected, use the mobile-optimized interface to update names, layouts, and appearance on the fly. 

| Remote Pairing |
|:---:|
| ![Remote Pairing](.github/assets/motion-poster-one-step-pairing.avif) <br> *Easy, one-step remote control pairing.* |

<br>

| **Theme Control** | **Update Labels** | **Add Hosts** |
| :---: | :---: | :---: |
| ![Theme Control](.github/assets/motion-poster-remote-ipad.avif) <br> *Choose a theme and customize it.* | ![Update Labels](.github/assets/motion-poster-remote-update-labels.avif) <br> *Update labels on the fly.* | ![Add Hosts](.github/assets/motion-poster-remote-add-names.avif) <br> *Add or remove names.* |

## Project Architecture and Technical Specs

This project is built as a lightweight web application. It is designed for maximum performance and easy deployment.

### File Structure
*   `index.html`: The core structure and entry point.
*   `js/main.js`: Initializes the application and handles loading states.
*   `js/themes.js`: Centralized configuration for all themes.
*   `js/EventPoster.js`: The central orchestrator managing state, persistence, and layout.
*   `js/modules/`:
    *   `ThemeManager.js`: Handles visual themes, color derivations, and CSS variables.
    *   `ParticleEngine.js`: Manages the high-performance atmospheric animation system.
    *   `UIController.js`: Manages all user interactions, keyboard shortcuts, and form logic.
    *   `Constants.js`: Centralized configuration for defaults and storage keys.
    *   `RemoteManager.js`: Handles peer-to-peer data syncing for the remote control feature.
    *   `Utils.js`: Helper functions and utilities used across the application.
*   `css/`:
    *   `styles.css`: Core layout engine and base utility classes.
    *   `ui-components.css`: Modern, modular UI styles for the management panel.
    *   `remote.css`: Specific styling for the mobile remote interface.
    *   `themes/`:
        *   `theme-[name].css`: Specific styling and animation overrides for each theme.

### Persistence Strategy
The application uses the browser's `localStorage` API to store all user configurations. This ensures that:
1.  Custom text and host lists are preserved.
2.  Uploaded images (stored as Base64 strings) remain available across sessions.
3.  Display settings (petal count, speed, colors) are remembered.

This architecture allows the project to remain entirely client-side, requiring no backend or database to function.

### Technical Specifications
*   **Language:** HTML5, CSS3, ES6+ JavaScript.
*   **Compatibility:** Chrome, Edge, Safari, Firefox.
*   **Optimized For:** 1080p (FHD) and 1440p (QHD) displays.
*   **Reliability:** Includes a silent video fallback for the Wake Lock API on older browsers.

### Technical Architecture: Remote Syncing

The remote control feature is designed to be completely zero-config and infrastructure-free for event environments with unpredictable internet access. 

- **Network Requirements:** Both the display device and the remote device only need to reside on the same local network (local venue Wi-Fi, ethernet, or a smartphone cellular hotspot).
- **Communication Protocol:** It uses local peer-to-peer data channels for syncing.
- **State Synchronization:** Actions are broadcast across the local connection, ensuring that state changes are mirrored instantly on the presentation UI.

*Note: Due to standard browser security specifications, entering or exiting full-screen mode must be done directly on the primary device and cannot be triggered via the remote.*

### Display Notes

- **Recommended viewport:** 1280×800px or larger. A "Larger Display Recommended" screen is shown on smaller devices, with an option to bypass.
- **Optimized for:** 1920×1080 and 2550×1440 displays. The layout includes resolution-aware CSS scaling for 1440p.
- **Wake Lock:** Uses the Screen Wake Lock API where available. Falls back to a silent looping video element to keep the screen awake on unsupported browsers.
- **Auto-fullscreen:** After a refresh while fullscreen was active, the poster will re-enter fullscreen automatically. This can be turned off.

---

## Version History

| Version | Notes |
|---------|-------|
| v8 | **New Theme Packs:** Added many more themes to choose from:<br>• **Party Pack:** Electric Pulse, Celebration, Summer Cookout, Tropical Oasis, Casino Night, Karaoke Night<br>• **Decades Pack:** Retro Wave, Disco Fever, Art Deco, Atomic Mid-Century, Memphis Pop, 00s Glass<br>• **Specialty Pack:** Cinema Premiere, Game Console, Space Odyssey, Bistro Lounge, Steampunk Gears, Deep Blue Sea<br>• **Holiday Pack:** Halloween Soiree, Autumn Harvest, Valentine's Romance, Mardi Gras, Festive Holiday, New Year's Eve<br>|
| v7.1 | **Minimal Elegance Theme:** Added a new theme for art galleries, museums, and brand showcases with a sophisticated and fashion-forward design. |
| v7 | **The Remote Update:** Remote control for managing and customizing the poster from a different device. |
| v6 | **The Themes Update:** Theme Engine with 5 curated themes: *Spring Blossom*, *Digital Grid*, *Alpine Winter*, *Vintage Radio*, *Corporate Pro*. Added dynamic particle system, improved color swatch management, and enhanced UI labels. Complete architectural refactor under the hood for greater extensibility. |
| v5 | Adds host management, content editing, color picker, local font hosting, auto-fullscreen option, high-res display optimizations, responsive font scaling, and small-screen handler. |
| v4 | Adds live host management, factory reset, auto-fullscreen, and responsive layouts. |
| v1–v3 | Earlier iterations with static host lists and limited controls. |

---

[demo]: https://motionposter.ryanmarch.me/
[demo-spring]: https://motionposter.ryanmarch.me/?theme=spring
[demo-digital-grid]: https://motionposter.ryanmarch.me/?theme=digital-grid
[demo-alpine-winter]: https://motionposter.ryanmarch.me/?theme=alpine-winter
[demo-vintage-radio]: https://motionposter.ryanmarch.me/?theme=vintage-radio
[demo-corporate]: https://motionposter.ryanmarch.me/?theme=corporate
[demo-minimal-elegance]: https://motionposter.ryanmarch.me/?theme=minimal-elegance
[demo-electric-pulse]: https://motionposter.ryanmarch.me/?theme=electric-pulse
[demo-celebration]: https://motionposter.ryanmarch.me/?theme=celebration
[demo-summer-cookout]: https://motionposter.ryanmarch.me/?theme=summer-cookout
[demo-tropical-oasis]: https://motionposter.ryanmarch.me/?theme=tropical-oasis
[demo-casino-night]: https://motionposter.ryanmarch.me/?theme=casino-night
[demo-game-console]: https://motionposter.ryanmarch.me/?theme=game-console
[demo-disco-fever]: https://motionposter.ryanmarch.me/?theme=disco-fever
[demo-mardi-gras]: https://motionposter.ryanmarch.me/?theme=mardi-gras
[demo-retro-wave]: https://motionposter.ryanmarch.me/?theme=retro-wave
[demo-art-deco-gala]: https://motionposter.ryanmarch.me/?theme=art-deco-gala
[demo-cinema]: https://motionposter.ryanmarch.me/?theme=cinema
[demo-halloween]: https://motionposter.ryanmarch.me/?theme=halloween
[demo-space-odyssey]: https://motionposter.ryanmarch.me/?theme=space-odyssey
[demo-atomic-mid-century]: https://motionposter.ryanmarch.me/?theme=atomic-mid-century
[demo-memphis-pop]: https://motionposter.ryanmarch.me/?theme=memphis-pop
[demo-00-glass]: https://motionposter.ryanmarch.me/?theme=00-glass
[demo-bistro-lounge]: https://motionposter.ryanmarch.me/?theme=bistro-lounge
[demo-deep-blue]: https://motionposter.ryanmarch.me/?theme=deep-blue
[demo-steampunk-gears]: https://motionposter.ryanmarch.me/?theme=steampunk-gears
[demo-autumn-harvest]: https://motionposter.ryanmarch.me/?theme=autumn-harvest
[demo-new-years-eve]: https://motionposter.ryanmarch.me/?theme=new-years-eve
[demo-valentines-romance]: https://motionposter.ryanmarch.me/?theme=valentines-romance
[demo-festive-holiday]: https://motionposter.ryanmarch.me/?theme=festive-holiday
[demo-karaoke-night]: https://motionposter.ryanmarch.me/?theme=karaoke-night