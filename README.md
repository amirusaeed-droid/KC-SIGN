# E-SOI Updated Pack

Changes included:
- Tool name changed from KC-SIGN to E-SOI.
- Header logo replaced with the new E-SOI logo.
- Removed the “PDF Signature Tool” text from the header.
- Downloaded file name changed to `E-SOI-signed.pdf`.
- Default E-SOI logo seal option removed. Only custom seal upload remains.
- Old KC-SIGN logo asset removed from the package.

Required structure:

E-SOI/
- index.html
- style.css
- script.js
- README.md
- assets/
  - e-soi-logo.png

Upload all files and the full assets folder to GitHub Pages.


## V8 fixes
- Footer text changed to “Developed by Amir Saeed”.
- Fixed mobile dragging issue where signature/stamp fields could disappear while moving.
- Fixed draw signature on phone using finger/touch with Pointer Events.


## Latest fix
- Signature and seal uploads are now preserved as original images to avoid color mismatch.
- Transparent PNG signatures now stay transparent.
- Removed the default E-SOI seal/logo option. Only custom seal upload remains.


## V3 quality fix
- Uploaded signatures are now cleaned automatically: white/grey paper background is removed and empty margins are cropped.
- Signature images are exported as transparent PNG before placing on the PDF, so they blend with the original document.
- Custom seal only: the default E-SOI logo seal option is removed.
- Finger/stylus drawing uses high-DPI pointer events for better mobile quality.
- Footer text: Developed by Amir Saeed.
