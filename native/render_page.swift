// Renders one PDF page to a PNG using PDFKit — the same rendering engine
// macOS Preview uses, so output matches Preview exactly (including PDF
// spec edge cases pdf.js handles differently, like invisible text-rendering
// modes on OCR'd pages).
//
// usage: render_page <pdf-path> <page-number> <output-png-path> [scale]
//   page-number is 1-indexed. scale defaults to 2.0 (crisp on retina
//   displays without an excessive file size).

import PDFKit
import AppKit

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 4 else {
    fail("usage: render_page <pdf-path> <page-number> <output-png-path> [scale]")
}

let pdfPath = args[1]
guard let pageNumber = Int(args[2]) else {
    fail("page-number must be an integer, got \"\(args[2])\"")
}
let outputPath = args[3]
var scale: CGFloat = 2.0
if args.count >= 5, let parsed = Double(args[4]) {
    scale = CGFloat(parsed)
}

guard let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    fail("Couldn't open PDF at \(pdfPath)")
}
guard let page = doc.page(at: pageNumber - 1) else {
    fail("Page \(pageNumber) out of range (document has \(doc.pageCount) pages)")
}

let bounds = page.bounds(for: .mediaBox)
let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

let image = NSImage(size: size)
image.lockFocus()
NSColor.white.set()
NSRect(origin: .zero, size: size).fill()
if let ctx = NSGraphicsContext.current?.cgContext {
    ctx.saveGState()
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    ctx.restoreGState()
}
image.unlockFocus()

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fail("Failed to encode rendered page as PNG")
}

do {
    try pngData.write(to: URL(fileURLWithPath: outputPath))
} catch {
    fail("Failed to write \(outputPath): \(error)")
}
