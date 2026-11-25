package expo.modules.vynrredaction

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

/**
 * Pixelates faces and text-like regions (number plates) in a photo, entirely on device.
 *
 * ML Kit's text recogniser also returns the recognised characters; this module
 * reads only each line's bounding box and never reads, stores or returns the text.
 */
class VynrRedactionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VynrRedaction")

    AsyncFunction("redact") { uri: String ->
      val context = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "No Android context", null)
      val parsed = Uri.parse(uri)
      val path = parsed.path ?: throw CodedException("ERR_UNREADABLE", "The photo could not be read.", null)

      val upright = decodeUpright(path)
      val image = InputImage.fromBitmap(upright, 0)

      val faceClient = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
          .setMinFaceSize(0.04f)
          .build()
      )
      val textClient = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val faces = Tasks.await(faceClient.process(image))
        val text = Tasks.await(textClient.process(image))

        val rects = ArrayList<Rect>()
        faces.forEach { rects.add(pad(it.boundingBox, upright)) }
        var textRegions = 0
        val maxArea = upright.width.toLong() * upright.height.toLong() / 5
        for (block in text.textBlocks) {
          for (line in block.lines) {
            val box = line.boundingBox ?: continue
            if (box.width().toLong() * box.height().toLong() > maxArea) continue
            rects.add(pad(box, upright))
            textRegions++
          }
        }

        val out = upright.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(out)
        val block = max(8, max(out.width, out.height) / 48)
        val paint = Paint().apply { isFilterBitmap = false }
        for (r in rects) {
          if (r.width() <= 0 || r.height() <= 0) continue
          val region = Bitmap.createBitmap(out, r.left, r.top, r.width(), r.height())
          val small = Bitmap.createScaledBitmap(region, max(1, r.width() / block), max(1, r.height() / block), false)
          val big = Bitmap.createScaledBitmap(small, r.width(), r.height(), false)
          canvas.drawBitmap(big, r.left.toFloat(), r.top.toFloat(), paint)
          region.recycle(); small.recycle(); big.recycle()
        }

        val dest = File(context.cacheDir, "vynr-redacted-${UUID.randomUUID()}.jpg")
        FileOutputStream(dest).use { out.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        val result = mapOf(
          "uri" to Uri.fromFile(dest).toString(),
          "width" to out.width,
          "height" to out.height,
          "faces" to faces.size,
          "textRegions" to textRegions,
        )
        if (out !== upright) out.recycle()
        upright.recycle()
        result
      } finally {
        faceClient.close()
        textClient.close()
      }
    }
  }

  private fun decodeUpright(path: String): Bitmap {
    val bitmap = BitmapFactory.decodeFile(path) ?: throw CodedException("ERR_UNREADABLE", "The photo could not be read.", null)
    val degrees = when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
    bitmap.recycle()
    return rotated
  }

  private fun pad(r: Rect, bmp: Bitmap): Rect {
    val dx = (r.width() * 0.18f).toInt()
    val dy = (r.height() * 0.18f).toInt()
    return Rect(
      max(0, r.left - dx),
      max(0, r.top - dy),
      min(bmp.width, r.right + dx),
      min(bmp.height, r.bottom + dy),
    )
  }
}
