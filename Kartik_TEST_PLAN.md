# Kartik Test Plan — LinkUp Verification Checklist

## Automated Verification
- [x] Link title extraction returns no repeated words (`https://developer.mozilla.org/en-US/docs/Web/JavaScript` -> `JavaScript | MDN`).
- [x] Embedding function returns 384 numbers for short text, long text (chunked mean pooling), and Hindi text.
- [x] Similarity between "Deep Learning" and "Introduction to ML" is higher than between "Deep Learning" and "Personal Finance".
- [x] Search: `"B-tree"` in keyword mode returns the Database Indexing card first.
- [x] Search: `"saving money every month"` in semantic mode returns the Personal Finance card first.
- [x] Long PDF: phrase `BLUE-HERON-47` is found by keyword search.
- [x] Upload of empty DOCX (`empty_document.docx`), `.txt` file (`unsupported_readme.txt`), and duplicate file each return a clear error without a server crash.
- [x] ZIP archive upload (`Kartik_Test_Files.zip`) extracts and ingests all valid documents while cleanly skipping unsupported/empty entries.
- [x] Multi-file batch upload ingests multiple PDFs/DOCX files in one request.
- [x] Assistant answers `"What is the capital of France?"` with `"not found in your cards"` and no invented answer.

## Manual Browser Checks (with Screenshots)
- [ ] Canvas: filter chips and counts are correct after adding and deleting cards.
- [ ] Graph: no node overlap, threshold slider changes edge count, clicking a node opens the card.
- [ ] Smart Arrange: unrelated topics (ML vs Finance vs Cooking vs History) are in separate clusters; Unclustered used instead of Uncategorized Notes; Regenerate keeps deterministic names.
- [ ] Assistant: every answer shows citations, markdown renders correctly (bold, lists, tables, code), greeting has no `100% Grounded` badge.
- [ ] Delete a card: disappears from search, graph, clusters, and assistant answers.
- [ ] Refresh page & sign out/in: data persists for same user and is empty for a new user.
