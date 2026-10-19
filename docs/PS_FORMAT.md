# Editable .ps lessons

Phoenix Smartboard `.ps` files use an uncompressed UTF-8 JSON document (`application/vnd.phoenix-smartboard+json`). Text remains text; pen strokes retain their points and pressure; shapes retain dimensions, colors and rotation. Page order, background and patterns are saved. Attachments retain their original bytes as base64 within the same file. Base64 is an encoding and increases binary size; there is no proprietary compression and no screenshot flattening of board notes.

Open a `.ps` file through Import to create an editable lesson copy. Object IDs are remapped to prevent collisions with existing lessons. Imported PDF/DOCX content remains a document attachment; annotations and text created on the board remain independently editable. Double-click a board text object to edit it.

New-format input is limited to 100 MB. Each attachment is limited to 25 MB. No files are extracted to arbitrary disk paths. Browser and folder backup snapshots use this same portable format.
