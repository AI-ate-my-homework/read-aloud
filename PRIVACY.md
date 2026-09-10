# Privacy Policy — Read Aloud

**Last updated:** 2026-09-10

Read Aloud does not collect, store, transmit, or sell any user data.

## What the extension does

- When you click the toolbar icon, right-click "Read from here," or use the
  keyboard shortcut, Read Aloud reads the text of the current tab and converts
  it to speech using an on-device neural text-to-speech model (Kokoro-82M).
- All text extraction and speech synthesis happen locally in your browser, in
  a script running on the page you opened and in the extension's own offscreen
  document. Nothing about the page content, the generated audio, or your
  usage is ever sent to a server operated by us or anyone else.

## What data is collected

None. Read Aloud has no analytics, no telemetry, no crash reporting, no
account system, and no backend server of any kind.

## Network activity

The only network requests Read Aloud makes are:

- A one-time download of the Kokoro text-to-speech model files (cached
  locally by the browser afterward, via standard Cache Storage/IndexedDB).
- Fetching a PDF file you opened yourself, so it can be rendered and read
  (the same request your browser would make anyway to display that PDF).

No page content, audio, or personal information is transmitted as part of
either of these.

## Permissions

- **activeTab / scripting** — used only in direct response to your own action
  (clicking the toolbar icon, using the context menu, or the keyboard
  shortcut) to inject the reader into the current tab.
- **offscreen** — runs the on-device Kokoro model in an offscreen document,
  since browser extension service workers can't run this kind of inference
  directly.
- **contextMenus** — adds the "Read from here" right-click menu item.
- **declarativeNetRequest / declarativeNetRequestWithHostAccess** and broad
  host access — used solely to redirect direct navigations to a `.pdf` URL
  into the extension's bundled PDF viewer, so the PDF's text can be extracted
  and read aloud. No content is inspected or modified for any other purpose.

## Changes to this policy

If this policy changes, the update will be reflected in this file in the
project's public repository, with the "Last updated" date above revised
accordingly.

## Contact

Questions about this policy can be filed as an issue on the project's GitHub
repository.
