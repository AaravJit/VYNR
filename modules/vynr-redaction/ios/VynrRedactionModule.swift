import CoreImage
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import Vision

/// Pixelates faces and text-like regions (number plates) in a photo, entirely on device.
///
/// Uses Apple Vision's face-rectangle and text-rectangle detectors. The text
/// detector only reports where text is; it never recognises characters, so no
/// plate is ever read. The output is an upright JPEG in the caches directory.
public class VynrRedactionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VynrRedaction")

    AsyncFunction("redact") { (uri: String) -> [String: Any] in
      try Redactor.redact(uri: uri)
    }
  }
}

enum RedactionError: Error, CustomStringConvertible {
  case unreadable
  case encodeFailed

  var description: String {
    switch self {
    case .unreadable: return "The photo could not be read."
    case .encodeFailed: return "The redacted photo could not be encoded."
    }
  }
}

enum Redactor {
  /// Regions are padded so a slightly loose box still covers the whole face or plate.
  static let padding: CGFloat = 0.18

  static func redact(uri: String) throws -> [String: Any] {
    let url: URL? = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
    guard let url,
          let input = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
    else { throw RedactionError.unreadable }

    let extent = input.extent
    let handler = VNImageRequestHandler(ciImage: input, options: [:])
    let faces = VNDetectFaceRectanglesRequest()
    let text = VNDetectTextRectanglesRequest()
    text.reportCharacterBoxes = false
    try handler.perform([faces, text])

    var rects: [CGRect] = []
    for f in faces.results ?? [] {
      rects.append(pad(VNImageRectForNormalizedRect(f.boundingBox, Int(extent.width), Int(extent.height))))
    }
    var textCount = 0
    for t in text.results ?? [] {
      let r = VNImageRectForNormalizedRect(t.boundingBox, Int(extent.width), Int(extent.height))
      // Large text areas (posters, billboards) are skipped; plates and badges are small.
      if r.width * r.height > extent.width * extent.height * 0.2 { continue }
      rects.append(pad(r))
      textCount += 1
    }

    var output = input
    if !rects.isEmpty {
      let pixellate = CIFilter.pixellate()
      pixellate.inputImage = input.clampedToExtent()
      pixellate.scale = Float(max(extent.width, extent.height) / 48)
      pixellate.center = CGPoint(x: extent.midX, y: extent.midY)
      if let pixelated = pixellate.outputImage {
        for r in rects {
          output = pixelated.cropped(to: r.intersection(extent)).composited(over: output)
        }
      }
      output = output.cropped(to: extent)
    }

    let context = CIContext()
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    guard let data = context.jpegRepresentation(
      of: output,
      colorSpace: colorSpace,
      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9]
    ) else { throw RedactionError.encodeFailed }

    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("vynr-redacted-\(UUID().uuidString).jpg")
    try data.write(to: dest, options: .atomic)
    return [
      "uri": dest.absoluteString,
      "width": Int(extent.width),
      "height": Int(extent.height),
      "faces": faces.results?.count ?? 0,
      "textRegions": textCount,
    ]
  }

  static func pad(_ r: CGRect) -> CGRect {
    r.insetBy(dx: -r.width * padding, dy: -r.height * padding)
  }
}
