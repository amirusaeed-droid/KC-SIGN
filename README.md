# E-SOI Updated Pack V6 - Signature Optimizer

## Main improvements
- Added **Signature Optimizer** for low-quality, dark-background, scanned, and mobile photo signatures.
- Added live **Original vs Enhanced** preview before inserting the signature.
- Added **Improve low quality signature** option.
- Added **Remove paper / dark background** option.
- Added **Clean strength** slider to control background removal.
- Added **Ink colour modes**:
  - Original colour
  - Clean blue ink
  - Clean black ink
- Added automatic crop around the signature.
- Added automatic upscaling for small uploaded signatures.
- Improved contrast and opacity for weak signature lines.
- Kept custom seal upload only. The default E-SOI logo seal option is removed.
- Footer remains: **Developed by Amir Saeed**.

## Recommended use
For clean signatures:
1. Upload the PDF.
2. Click **Signature**.
3. Open the **Upload** tab.
4. Upload signature image.
5. Keep **Improve low quality signature** enabled.
6. Keep **Remove paper / dark background** enabled.
7. Choose **Clean blue ink** or **Clean black ink**.
8. Adjust **Clean strength** until the preview looks good.
9. Click **Use Signature**.

## Files
- index.html
- style.css
- script.js
- assets/e-soi-logo.png

## V7 Mobile Drag + Dark Mode Fix
- Fixed dark mode contrast in Signature Optimizer and all modal controls.
- Improved phone dragging using Pointer Events, pointer capture and scroll lock while dragging.
- Signature fields are locked to the current page on touch devices to stop disappearing while dragging.
- Added touch-action protection for fields and draw canvas.
- Re-prepares high-DPI draw canvas when opening the signature modal.

## V8 Mobile Drag Stability Fix
- Fixed mobile issue where signatures could disappear or jump while dragging.
- Fields are now preserved when the browser triggers a mobile resize or PDF re-render.
- PDF page re-rendering is paused during drag/resize and resumed safely after release.
- Signature/text/seal positions are saved by page ratio and restored correctly after zoom or resize.
- Added safer Pointer Events handling for mobile, tablet, stylus and desktop.
